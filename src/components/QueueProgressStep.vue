<script setup lang="ts">
import { LogProgressStatus } from "~/lib/parsed_log";
import { Step } from "~/types/transcoder";

defineProps<{ process: Step }>();
</script>

<template>
  <div class="text-xs text-slate-700">
    <span
      v-if="process?.status === LogProgressStatus.WORKING"
      :class="process.percent !== 100 ? 'text-blue-500' : 'text-green-500'"
    >
      {{ process.percent?.toFixed(2) }}%
    </span>
    <span
      v-else
      :class="{
        'text-red-500': process?.status === LogProgressStatus.ERROR,
        'text-green-500': process?.status === LogProgressStatus.DONE,
      }"
      >{{ process?.status ?? LogProgressStatus.QUEUED }}</span
    >
  </div>
</template>
