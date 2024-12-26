<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Resolutions } from "./lib/transcoder";
import { Command } from "@tauri-apps/plugin-shell";
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

const status = ref<Statuses>(Statuses.IDLE);
const logs = ref<ParsedLogContract[]>([]);

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
  });

  command.on("close", (_arg) => {
    status.value = Statuses.IDLE;
  });

  await command.spawn();
}

onMounted(async () => {
  form.value.output = await videoDir();
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
    />
  </section>
</template>
