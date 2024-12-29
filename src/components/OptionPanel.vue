<script setup lang="ts">
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { allowedExtensions, Resolutions } from "~/lib/transcoder";
import { enumKeys } from "~/lib/utils";
import { Form, Statuses } from "~/types/form";
import Checkbox from "./ui/checkbox/Checkbox.vue";
import Label from "./ui/label/Label.vue";
import Button from "./ui/button/Button.vue";
import Input from "./ui/input/Input.vue";
import {
  CornerDownRight,
  FilePlus,
  Folder,
  FolderPlus,
  Info,
  Loader2,
  Play,
  X,
} from "lucide-vue-next";

defineProps<{ status: Statuses; pending: string[] }>();

const emit = defineEmits(["transcode", "cancel"]);

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
    <form id="form" class="w-full flex-1 flex flex-col p-4 gap-4 bg-slate-50">
      <div class="flex items-center gap-4">
        <Label class="flex-1">
          <span class="inline-block mb-1">Output Directory</span>
          <Button
            type="button"
            variant="outline"
            class="flex w-full gap-4 justify-between !text-xs"
            @click="pickOutputFolder"
          >
            {{ form.output }}
            <Folder />
          </Button>
        </Label>
      </div>

      <fieldset class="border border-slate-200 p-4 rounded-lg">
        <legend class="-ml-2 px-2 text-sm font-bold">Output Id</legend>
        <p class="text-xs text-slate-500 -mt-4 mb-1">
          Use an id for each item's output folder instead of the filename?
        </p>
        <div class="flex flex-col gap-1.5">
          <Label class="flex items-center gap-x-2">
            <Checkbox v-model:checked="form.useCuid" />
            <span>Give each item a unique id</span>
          </Label>

          <Label v-show="form.useCuid" class="flex items-center gap-x-2">
            <CornerDownRight class="w-4 h-4" />
            <Checkbox v-model:checked="form.keepPrefix" />
            <span
              >Keep prefix
              <span class="text-slate-500" style="font-size: 0.6rem"
                >(ex: prefix{{ form.prefixSeparator }}{id}.mp4)</span
              >
            </span>
          </Label>

          <Label
            v-show="form.useCuid && form.keepPrefix"
            class="ml-6 flex items-center gap-2"
          >
            <Input
              class="text-xs w-[16px] !h-[16px] !rounded !px-1"
              v-model="form.prefixSeparator"
            />
            <span class="block">Prefix Separator</span>
          </Label>
        </div>
      </fieldset>

      <fieldset class="border border-slate-200 p-4 rounded-lg">
        <legend class="-ml-2 px-2 text-sm font-bold">
          Transcode Resolutions
        </legend>
        <p class="text-xs text-slate-500 -mt-4 mb-4">
          Select which resolutions you want to transcode HLS segments for.
        </p>
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
      </fieldset>

      <fieldset class="border border-slate-200 p-4 rounded-lg">
        <legend class="-ml-2 px-2 text-sm font-bold">Compress MP4</legend>
        <p class="text-xs text-slate-500 -mt-4 mb-1">
          Include a compressed version of the MP4 file(s)? Useful for
          downloading.
        </p>
        <p class="text-xs text-slate-500 mb-4 flex items-center">
          <Info class="w-3 h-3 mr-2" />
          <span
            >Resolution:
            {{
              form.resolutions.length
                ? Math.max(...form.resolutions)
                : Resolutions.P2160
            }}p</span
          >
        </p>
        <div class="flex flex-col gap-1.5">
          <Label class="flex items-center gap-x-2">
            <Checkbox v-model:checked="form.includeMp4" />
            <span>Yes, Compress MP4</span>
          </Label>
        </div>
      </fieldset>

      <fieldset class="border border-slate-200 p-4 rounded-lg">
        <legend class="-ml-2 px-2 text-sm font-bold">Generate WebP</legend>
        <p class="text-xs text-slate-500 -mt-4 mb-1">
          Generate a 6s animated webp image?
        </p>
        <p class="text-xs text-slate-500 mb-4 flex items-center">
          <Info class="w-3 h-3 mr-2" />
          <span>Width: 320p</span>
        </p>
        <div class="flex flex-col gap-1.5">
          <Label class="flex items-center gap-x-2">
            <Checkbox v-model:checked="form.includeWebp" />
            <span>Yes, Generate WebP</span>
          </Label>
        </div>
      </fieldset>
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
        v-if="status === Statuses.PROCESSING"
        @click="$emit('cancel')"
        variant="destructive"
        size="sm"
        class="relative px-6"
      >
        <X class="absolute left-3" />
        Cancel
      </Button>

      <Button
        @click="$emit('transcode')"
        :disabled="!pending.length || status === Statuses.PROCESSING"
        size="sm"
        class="relative px-6"
      >
        <Play v-if="status !== Statuses.PROCESSING" class="absolute left-3" />
        <Loader2 v-else class="animate-spin absolute left-3" />
        <span v-if="status === Statuses.PROCESSING"> Running... </span>
        <span v-else-if="form.resolutions.length"> Transcode </span>
        <span v-else> Run </span>
      </Button>
    </div>
  </div>
</template>
