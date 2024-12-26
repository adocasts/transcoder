<script setup lang="ts">
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { computed } from "vue";
import { LogProgressStatus } from "~/lib/parsed_log";
import { allowedExtensions, Resolutions } from "~/lib/transcoder";
import { enumKeys } from "~/lib/utils";
import { Form, Statuses } from "~/types/form";
import Checkbox from "./ui/checkbox/Checkbox.vue";
import Label from "./ui/label/Label.vue";
import Button from "./ui/button/Button.vue";
import { FilePlus, Folder, FolderPlus, Loader2, Play } from "lucide-vue-next";

defineProps<{ status: Statuses; pending: string[] }>();

const emit = defineEmits(["transcode"]);

const form = defineModel<Form>({ required: true });

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

function toggleResolution(resolution: Resolutions) {
  const index = form.value.resolutions.indexOf(resolution);

  if (index > -1) {
    form.value.resolutions.splice(index, 1);
  } else {
    form.value.resolutions.push(resolution);
  }
}
</script>

<template>
  <div class="w-[300px] flex flex-col justify-between">
    <form id="form" class="w-full flex-1 p-4 bg-slate-50">
      <div class="flex items-center gap-4 mb-4">
        <Label class="flex-1">
          <span class="inline-block mb-1">Output directory</span>
          <Button
            variant="outline"
            class="flex w-full gap-4 justify-between !text-xs"
            @click="pickOutputFolder"
          >
            {{ form.output }}
            <Folder />
          </Button>
        </Label>
      </div>

      <div>
        <Label>
          <span class="inline-block mb-2">Output Resolutions</span>
        </Label>
        <div class="flex flex-col gap-1.5">
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
    </form>

    <div class="w-full flex flex-col gap-2 p-4 bg-slate-100">
      <Button
        @click="addFilesToQueue"
        variant="outline"
        size="sm"
        class="relative px-6"
      >
        <FilePlus class="absolute left-3" />
        Add file(s)
      </Button>

      <Button
        @click="addFoldersToQueue"
        variant="outline"
        size="sm"
        class="relative px-6"
      >
        <FolderPlus class="absolute left-3" />
        Add folder(s)
      </Button>

      <Button
        @click="$emit('transcode')"
        :disabled="!pending.length || status === Statuses.PROCESSING"
        size="sm"
        class="relative px-6"
      >
        <Play v-if="status !== Statuses.PROCESSING" class="absolute left-3" />
        <Loader2 v-else class="animate-spin absolute left-3" />
        {{ status === Statuses.PROCESSING ? "Running ..." : "Transcode" }}
      </Button>
    </div>
  </div>
</template>
