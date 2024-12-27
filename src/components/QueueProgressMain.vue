<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { computed } from "vue";
import { LogProgressStatus } from "~/lib/parsed_log";
import { Progress, Step } from "~/types/transcoder";

const props = defineProps<{ progress?: Progress; processes?: Step[] }>();
const isWorking = computed(() => {
  const isMainWorking = props.progress?.status !== LogProgressStatus.DONE;
  const isMainNotError = props.progress?.status !== LogProgressStatus.ERROR;
  const hasProcesses = !!props.processes?.length;

  return isMainWorking && isMainNotError && hasProcesses;
});
</script>

<template>
  <div>
    <span
      v-if="isWorking"
      :class="[
        'flex items-center',
        progress?.percent !== 100 ? 'text-blue-500' : 'text-green-500',
      ]"
    >
      <Loader2 class="animate-spin w-3 h-3 mr-2" />
      Processing
    </span>
    <span
      v-else
      :class="{
        'text-red-500': progress?.status === LogProgressStatus.ERROR,
        'text-green-500': progress?.status === LogProgressStatus.DONE,
      }"
      >{{ progress?.status ?? LogProgressStatus.QUEUED }}</span
    >

    <slot v-if="isWorking" />
  </div>
</template>
