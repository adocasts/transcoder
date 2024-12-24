<script setup lang="ts">
import { ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import Button from "./components/ui/button/Button.vue";
import { FilePlus, FolderPlus, Play, X } from "lucide-vue-next";
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

const allowedExtensions = ["mp4", "mkv", "webm", "mov"];
const queue = ref(
  new Map<string, { filename: string; bytes: number; extname: string }>()
);

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

  queue.value.set(file, { filename, extname, bytes: metadata.size });
}

function bytesToSize(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "n/a";
  const i = Math.floor(Math.log2(bytes) / 10);
  return parseFloat((bytes / 2 ** (i * 10)).toFixed(1)) + " " + sizes[i];
}

async function transcode() {}
</script>

<template>
  <main class="p-4">
    <h1 class="text-3xl font-bold">Adocasts Transcoder</h1>
    <p class="text-slate-500 text-sm mb-6">
      Transcode video files for Cloudflare R2 storage
    </p>

    <div class="border rounded-lg shadow overflow-hidden">
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
        <TableBody v-if="queue.size">
          <TableRow
            v-for="([path, { filename, extname, bytes }], index) in queue"
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
                class="hover:text-red-500"
                @click="queue.delete(path)"
              >
                <X />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
        <TableBody v-else>
          <TableRow>
            <TableCell colspan="4" class="text-slate-500 text-sm">
              No files in queue
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex gap-4 mt-4">
      <Button @click="addFilesToQueue">
        <FilePlus />
        Add file(s) to queue
      </Button>

      <Button @click="addFoldersToQueue">
        <FolderPlus />
        Add folder(s) to queue
      </Button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger :as-child="!!queue.size">
            <Button
              variant="secondary"
              :disabled="!queue.size"
              @click="transcode"
            >
              <Play />
              Transcode
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p v-if="queue.size">
              Transcode video files for Cloudflare R2 storage
            </p>
            <p v-else class="text-slate-500 text-sm">
              Please add at least one video file to transcode
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </main>
</template>
