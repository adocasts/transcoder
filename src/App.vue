<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import Button from "./components/ui/button/Button.vue";
import {
  Folder,
  FilePlus,
  FolderPlus,
  Play,
  X,
  Loader2,
} from "lucide-vue-next";
import Table from "./components/ui/table/Table.vue";
import TableHeader from "./components/ui/table/TableHeader.vue";
import TableRow from "./components/ui/table/TableRow.vue";
import TableHead from "./components/ui/table/TableHead.vue";
import TableBody from "./components/ui/table/TableBody.vue";
import TableCell from "./components/ui/table/TableCell.vue";
import Label from "./components/ui/label/Label.vue";
import { Resolutions, allowedExtensions } from "./lib/transcoder";
import { Command } from "@tauri-apps/plugin-shell";
import { videoDir } from "@tauri-apps/api/path";
import ParsedLog, { LogProgressStatus, LogTypes } from "./lib/parsed_log";
import ResolutionInput from "./components/ResolutionInput.vue";
import Checkbox from "./components/ui/checkbox/Checkbox.vue";
import { enumKeys } from "./lib/utils";

type TranscoderQueueFile = {
  filename: string;
  extname: string;
  bytes: number;
  progress?: { percent: number; file: string; status: LogProgressStatus };
};

type TranscoderQueue = Map<string, TranscoderQueueFile>;

type Form = {
  queue: TranscoderQueue;
  resolutions: Resolutions[];
  output: string;
};

enum Statuses {
  IDLE = "idle",
  PROCESSING = "processing",
  ERROR = "error",
}

const status = ref<Statuses>(Statuses.IDLE);
const logs = ref<ParsedLog[]>([]);
const logsRef = ref<HTMLDivElement | null>(null);
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

async function pickOutputFolder() {
  const folder = await open({
    title: "Select output folder",
    directory: true,
    multiple: false,
  });

  if (!folder) return;

  form.value.output = folder;
}

async function addFoldersToQueue() {
  const folders = await open({
    title: "Select folder(s) to transcode",
    multiple: true,
    directory: true,
  });

  for (const folder of folders ?? []) {
    const entries = await readDir(folder);
    const files = await entries.filter((entry) => {
      if (!entry.isFile) return false;
      return allowedExtensions.includes(entry.name.split(".").pop() as string);
    });

    for (const file of files) {
      await addFileToQueue(`${folder}/${file.name}`);
    }
  }
}

async function addFilesToQueue() {
  const files = await open({
    title: "Select video(s) to transcode",
    multiple: true,
    directory: false,
    filters: [{ name: "Video Files", extensions: allowedExtensions }],
  });

  for (const file of files ?? []) {
    await addFileToQueue(file);
  }
}

async function addFileToQueue(file: string) {
  const filename = file.split("/").pop() as string;
  const extname = filename.split(".").pop() as string;

  if (!allowedExtensions.includes(extname)) {
    return;
  }

  const metadata = await stat(file);

  form.value.queue.set(file, { filename, extname, bytes: metadata.size });
}

function bytesToSize(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "n/a";
  const i = Math.floor(Math.log2(bytes) / 10);
  return parseFloat((bytes / 2 ** (i * 10)).toFixed(1)) + " " + sizes[i];
}

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

    logs.value.push(log);

    nextTick(() =>
      logsRef.value?.scrollTo({
        top: logsRef.value.scrollHeight,
        behavior: "smooth",
      })
    );
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

function toggleResolution(resolution: Resolutions) {
  const index = form.value.resolutions.indexOf(resolution);

  if (index > -1) {
    form.value.resolutions.splice(index, 1);
  } else {
    form.value.resolutions.push(resolution);
  }
}

onMounted(async () => {
  form.value.output = await videoDir();
});
</script>

<template>
  <header class="bg-slate-50 p-4 flex justify-between items-center">
    <h1 class="text-xl font-bold">Transcoder Queue</h1>
    <div class="flex items-center gap-4">
      <Button @click="addFilesToQueue" variant="secondary" size="sm">
        <FilePlus />
        Add file(s)
      </Button>

      <Button @click="addFoldersToQueue" variant="secondary" size="sm">
        <FolderPlus />
        Add folder(s)
      </Button>

      <Button
        @click="transcode"
        :disabled="!pendingQueue.length || status === Statuses.PROCESSING"
        size="sm"
      >
        <Play v-if="status !== Statuses.PROCESSING" />
        <Loader2 v-else class="animate-spin" />
        {{ status === Statuses.PROCESSING ? "Running ..." : "Transcode" }}
      </Button>
    </div>
  </header>
  <main class="flex flex-col flex-1">
    <div class="h-full flex flex-col justify-between gap-3">
      <div>
        <div class="flex items-center gap-4 p-4">
          <Label class="flex-1">
            <span class="inline-block mb-1">Output directory</span>
            <Button
              variant="secondary"
              class="flex w-full gap-4 justify-start bg-slate-50"
              @click="pickOutputFolder"
            >
              <Folder />
              {{ form.output }}
            </Button>
          </Label>
        </div>

        <div class="px-4">
          <div class="mb-1">Output resolutions</div>
          <div class="flex flex-col gap-1">
            <Label
              v-for="name in enumKeys(Resolutions)"
              :key="name"
              class="flex items-center gap-x-2"
            >
              <Checkbox
                :checked="form.resolutions.includes(Resolutions[name])"
                @update:checked="toggleResolution(Resolutions[name])"
              />
              <span>{{ Resolutions[name] }}p</span>
            </Label>
          </div>
        </div>

        <div class="bg-slate-50 m-4 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[50px]">#</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead class="w-[150px]">Status</TableHead>
                <TableHead class="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody v-if="form.queue.size">
              <TableRow
                v-for="(
                  [path, { filename, extname, bytes, progress }], index
                ) in form.queue"
                :key="path"
              >
                <TableCell>{{ index + 1 }}</TableCell>
                <TableCell>{{ filename }}</TableCell>
                <TableCell>{{ extname }}</TableCell>
                <TableCell>{{ bytesToSize(bytes) }}</TableCell>
                <TableCell>
                  <span
                    v-if="progress?.status === LogProgressStatus.WORKING"
                    :class="
                      progress.percent < 100
                        ? 'text-blue-500'
                        : 'text-green-500'
                    "
                  >
                    {{ progress.percent.toFixed(2) }}%
                  </span>
                  <span
                    v-else
                    :class="{
                      'text-red-500':
                        progress?.status === LogProgressStatus.ERROR,
                      'text-green-500':
                        progress?.status === LogProgressStatus.DONE,
                    }"
                    >{{ progress?.status ?? LogProgressStatus.QUEUED }}</span
                  >
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="hover:text-red-500 !w-6 !h-6"
                    @click="form.queue.delete(path)"
                  >
                    <X />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
            <TableBody v-else>
              <TableRow>
                <TableCell colspan="5" class="text-slate-500 text-sm">
                  No files in queue
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div
        ref="logsRef"
        v-if="logs.length || status !== Statuses.IDLE"
        class="text-xs bg-slate-950 text-slate-300 m-4 pb-4 rounded-lg font-mono max-h-[400px] overflow-y-auto"
      >
        <div
          class="sticky top-0 bg-slate-950 text-white font-bold uppercase tracking-wider pl-4 pr-2 py-2 flex justify-between items-center"
        >
          <div class="text-sm">CONSOLE:</div>
          <Button variant="ghost" size="sm" @click="logs = []">
            <X />
            Clear
          </Button>
        </div>
        <div
          v-for="line in logs"
          :key="line.message"
          class="px-4"
          :class="{
            'text-slate-500': line.type === 'debug',
            'text-green-300': line.type === 'success',
            'text-red-300': line.type === 'error',
            'text-slate-100': line.type === 'info',
          }"
        >
          <pre>{{ line.message }}</pre>
        </div>
      </div>
    </div>
  </main>
</template>
