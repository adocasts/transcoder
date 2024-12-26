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
  resolutions: [
    Resolutions.P2160,
    Resolutions.P1440,
    Resolutions.P1080,
    Resolutions.P720,
    Resolutions.P480,
  ],
  output: "",
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

  const { resolutions, output } = form.value;
  const command = Command.sidecar("binaries/node-transcoder", [
    "transcode",
    output,
    resolutions.join(","),
    pendingQueue.value.join(","),
  ]);

  command.stderr.on("data", (data) => {
    console.error(data);
    logs.value.push(ParsedLog.stderr(data));
  });

  command.stdout.on("data", (data) => {
    console.log(data);
    const log = new ParsedLog(data);

    if (log.type === LogTypes.PROGRESS && log.progress?.file) {
      const item = form.value.queue.get(log.progress.file);

      if (item) {
        item.progress = log.progress;
      }

      return;
    }

    // if last log starts with [progress] and current log starts with [progress] replace last log
    if (
      logs.value.length &&
      logs.value[logs.value.length - 1].message.startsWith("[progress]:") &&
      log.message.startsWith("[progress]:")
    ) {
      logs.value[logs.value.length - 1] = log;
      return;
    }

    logs.value.push(log);
  });

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

function cancel() {
  if (childProcess.value) {
    childProcess.value.kill();

    const log = new ParsedLog();

    log.type = LogTypes.INFO;
    log.message = "Transcoding cancelled";
    logs.value.push(log);
  }
}

onMounted(async () => {
  const canSendNotifications = await isPermissionGranted();
  canNotify.value = canSendNotifications;

  store = await load("store.json", { autoSave: true });

  const resolutions = await store.get<Resolutions[]>("resolutions");
  const output = await store.get<string>("output");

  form.value.resolutions = resolutions || form.value.resolutions;
  form.value.output = output || (await videoDir());
});

onUnmounted(async () => {
  if (store) {
    await store.set("resolutions", form.value.resolutions);
    await store.set("output", form.value.output);
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
