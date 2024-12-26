<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ParsedLogContract } from "~/lib/parsed_log";
import Button from "./ui/button/Button.vue";

const logs = defineModel<ParsedLogContract[]>({ required: true });
const logsRef = ref<HTMLDivElement | null>(null);

watch(
  () => logs.value.length,
  () => {
    nextTick(() => {
      logsRef.value?.scrollTo({
        top: logsRef.value.scrollHeight,
        behavior: "smooth",
      });
    });
  }
);
</script>

<template>
  <div
    ref="logsRef"
    class="text-xs bg-slate-950 text-slate-300 m-4 mt-0 pb-4 rounded-lg font-mono overflow-y-auto"
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
</template>
