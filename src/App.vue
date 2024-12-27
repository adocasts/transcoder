<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Resolutions } from "./lib/transcoder";
import { Child, Command } from "@tauri-apps/plugin-shell";
import { videoDir } from "@tauri-apps/api/path";
import ParsedLog, {
  LogProgressStatus,
  LogTypes,
  ParsedLogContract,
} from "./lib/parsed_log";
import { Form, Statuses } from "./types/form";
import OptionPanel from "./components/OptionPanel.vue";
import QueueTable from "./components/QueueTable.vue";
import Console from "./components/Console.vue";
import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { load, Store } from "@tauri-apps/plugin-store";

let store: Store | null = null;

const status = ref<Statuses>(Statuses.IDLE);
const logs = ref<ParsedLogContract[]>([]);
const childProcess = ref<Child | null>(null);
const canNotify = ref(false);

const form = ref<Form>({
  queue: new Map([]),
  output: "",
  includeWebp: true,
  includeMp4: true,
  resolutions: [
    Resolutions.P2160,
    Resolutions.P1440,
    Resolutions.P1080,
    Resolutions.P720,
    Resolutions.P480,
  ],
});

const showConsole = computed(
  () => logs.value.length || status.value !== Statuses.IDLE
);

const pendingQueue = computed(() => {
  let queue: string[] = [];

  for (const [key, file] of form.value.queue) {
    if (file.progress?.status === LogProgressStatus.DONE) {
      continue;
    }

    queue.push(key);
  }

  return queue;
});

async function transcode() {
  logs.value = [];

  status.value = Statuses.PROCESSING;

  const { resolutions, output, includeMp4, includeWebp } = form.value;
  const command = Command.sidecar("binaries/node-transcoder", [
    "transcode",
    output,
    includeMp4.toString(),
    includeWebp.toString(),
    resolutions.join(","),
    pendingQueue.value.join(","),
  ]);

  command.stderr.on("data", (data) => logs.value.push(ParsedLog.stderr(data)));
  command.stdout.on("data", stdoutHandler);

  command.on("error", (err) => {
    console.error(err);
    status.value = Statuses.ERROR;

    if (canNotify.value) {
      sendNotification({
        title: "Transcoding error",
        body: err,
      });
    }
  });

  command.on("close", (_arg) => {
    status.value = Statuses.IDLE;

    if (canNotify.value) {
      sendNotification("Transcoding queue completed");
    }
  });

  childProcess.value = await command.spawn();
}

// #region stdout

function stdoutHandler(data: string) {
  const log = new ParsedLog(data);

  switch (log.type) {
    case LogTypes.STEP:
      return stdoutStepHandler(log);
    case LogTypes.PROGRESS:
      return stdoutProgressHandler(log);
    default:
      return stdoutMessageHandler(log);
  }
}

function stdoutStepHandler(log: ParsedLog) {
  if (!log.step?.file) return;

  const item = form.value.queue.get(log.step.file);

  if (!item) return;

  item.processes = [...(item.processes ?? []), log.step];
}

function stdoutProgressHandler(log: ParsedLog) {
  if (!log.progress?.file) return;

  const item = form.value.queue.get(log.progress.file);

  if (!item) return;

  item.progress = log.progress;
  console.log({ progressItem: { ...item } });
  // if there is a step, update its progress & status
  if (item.processes?.length) {
    item.processes[item.processes.length - 1].percent = log.progress.percent;
    item.processes[item.processes.length - 1].status = log.progress.status;
  }
}

function stdoutMessageHandler(log: ParsedLog) {
  // If the last log starts with "[progress]:" and the current log starts with "[progress]:", replace the last log
  const lastMessage = logs.value[logs.value.length - 1]?.message;

  if (
    lastMessage?.startsWith("[progress]:") &&
    log.message?.startsWith("[progress]:")
  ) {
    logs.value[logs.value.length - 1] = log;
    return;
  }

  logs.value.push(log);
}

// #endregion

async function cancel() {
  if (childProcess.value) {
    await childProcess.value.write("cancel");
    await childProcess.value.kill();

    const log = new ParsedLog();

    log.type = LogTypes.INFO;
    log.message = "Transcoding cancelled";
    logs.value.push(log);

    for (const item of form.value.queue.values()) {
      if (item.progress?.status === LogProgressStatus.DONE) {
        continue;
      }

      item.processes = undefined;
      item.progress = undefined;
    }
  }
}

onMounted(async () => {
  const canSendNotifications = await isPermissionGranted();
  canNotify.value = canSendNotifications;

  store = await load("store.json", { autoSave: true });

  const resolutions = await store.get<Resolutions[]>("resolutions");
  const output = await store.get<string>("output");
  const includeMp4 = await store.get<boolean>("includeMp4");
  const includeWebp = await store.get<boolean>("includeWebp");

  form.value.resolutions = resolutions || form.value.resolutions;
  form.value.output = output || (await videoDir());
  form.value.includeMp4 = typeof includeMp4 === "boolean" ? includeMp4 : true;
  form.value.includeWebp =
    typeof includeWebp === "boolean" ? includeWebp : true;
});

onUnmounted(async () => {
  if (store) {
    await store.set("resolutions", form.value.resolutions);
    await store.set("output", form.value.output);
    await store.set("includeWebp", form.value.includeWebp);
    await store.set("includeMp4", form.value.includeMp4);
    await store.save();
  }
});
</script>

<template>
  <section class="flex h-full">
    <main class="w-[calc(100%-300px)] h-screen flex flex-col justify-between">
      <QueueTable class="flex-1" v-model="form" />
      <Console v-if="showConsole" class="h-[400px]" v-model="logs" />
    </main>

    <OptionPanel
      v-model="form"
      :status="status"
      :pending="pendingQueue"
      @transcode="transcode"
      @cancel="cancel"
    />
  </section>
</template>
