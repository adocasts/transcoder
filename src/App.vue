<script setup lang="ts">
import { onMounted, ref } from "vue";
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
import Tooltip from "./components/ui/tooltip/Tooltip.vue";
import TooltipProvider from "./components/ui/tooltip/TooltipProvider.vue";
import TooltipTrigger from "./components/ui/tooltip/TooltipTrigger.vue";
import TooltipContent from "./components/ui/tooltip/TooltipContent.vue";
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

type TranscoderQueueFile = { filename: string; extname: string; bytes: number };
type TranscoderQueue = Map<string, TranscoderQueueFile>;
type Form = {
  queue: TranscoderQueue;
  resolutions: Array<keyof typeof Resolutions>;
  output: string;
};

enum Statuses {
  IDLE = "idle",
  PROCESSING = "processing",
  ERROR = "error",
}

const status = ref<Statuses>(Statuses.IDLE);
const stdout = ref<string[]>([]);

const form = ref<Form>({
  queue: new Map([]),
  resolutions: ["P480"],
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
  stdout.value = [];

  status.value = Statuses.PROCESSING;

  const { queue, resolutions, output } = form.value;
  const command = Command.sidecar("binaries/node-transcoder", [
    "transcode",
    output,
    resolutions.join(","),
    Array.from(queue.keys()).join(","),
  ]);

  command.stdout.on("data", (data) => stdout.value.push(data));
  command.stderr.on("data", (data) => console.log({ stderr: data }));

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
        :disabled="!form.queue.size || status === Statuses.PROCESSING"
        size="sm"
      >
        <Play v-if="status !== Statuses.PROCESSING" />
        <Loader2 v-else class="animate-spin" />
        {{ status === Statuses.PROCESSING ? "Running ..." : "Transcode" }}
      </Button>
    </div>
  </header>
  <main>
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

      <div class="bg-slate-50 m-4 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[50px]">#</TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead class="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody v-if="form.queue.size">
            <TableRow
              v-for="(
                [path, { filename, extname, bytes }], index
              ) in form.queue"
              :key="path"
            >
              <TableCell>{{ index + 1 }}</TableCell>
              <TableCell>{{ filename }}</TableCell>
              <TableCell>{{ extname }}</TableCell>
              <TableCell>{{ bytesToSize(bytes) }}</TableCell>
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

      <div
        v-if="stdout.length || status !== Statuses.IDLE"
        class="text-xs bg-slate-950 text-slate-300 m-4 pb-4 rounded-lg font-mono max-h-[400px] overflow-y-auto"
      >
        <div
          class="sticky top-0 bg-slate-950 text-white font-bold uppercase tracking-wider pl-4 pr-2 py-2 flex justify-between items-center"
        >
          <div class="text-sm">Info:</div>
          <Button variant="ghost" size="sm" @click="stdout = []">
            <X />
            Clear
          </Button>
        </div>
        <div v-for="line in stdout" :key="line" class="px-4">
          <pre>{{ line }}</pre>
        </div>
      </div>
    </div>
  </main>
</template>
