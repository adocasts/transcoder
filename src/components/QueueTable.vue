<script setup lang="ts">
import Table from "./ui/table/Table.vue";
import TableHeader from "./ui/table/TableHeader.vue";
import TableRow from "./ui/table/TableRow.vue";
import TableHead from "./ui/table/TableHead.vue";
import TableBody from "./ui/table/TableBody.vue";
import TableCell from "./ui/table/TableCell.vue";
import { Form } from "~/types/form";
import { LogProgressStatus } from "~/lib/parsed_log";
import { Loader2, X } from "lucide-vue-next";
import Button from "./ui/button/Button.vue";

const form = defineModel<Form>({ required: true });

function bytesToSize(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "n/a";
  const i = Math.floor(Math.log2(bytes) / 10);
  return parseFloat((bytes / 2 ** (i * 10)).toFixed(1)) + " " + sizes[i];
}
</script>

<template>
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
            [path, { filename, extname, bytes, progress, processes }], index
          ) in form.queue"
          :key="path"
        >
          <TableCell class="align-top">{{ index + 1 }}</TableCell>
          <TableCell>
            <div>
              {{ filename }}
            </div>
            <div
              v-if="
                progress?.status !== LogProgressStatus.DONE && processes?.length
              "
              v-for="process in processes"
              :key="process.index"
              class="text-right text-xs text-slate-700"
            >
              {{ process.process }}
            </div>
          </TableCell>
          <TableCell class="align-top">{{ extname }}</TableCell>
          <TableCell class="align-top">{{ bytesToSize(bytes) }}</TableCell>
          <TableCell>
            <span
              v-if="progress?.status === LogProgressStatus.WORKING"
              class="flex items-center"
              :class="
                progress.percent < 100 ? 'text-blue-500' : 'text-green-500'
              "
            >
              <Loader2 class="animate-spin w-3 h-3 mr-2" /> Processing
            </span>
            <span
              v-else
              :class="{
                'text-red-500': progress?.status === LogProgressStatus.ERROR,
                'text-green-500': progress?.status === LogProgressStatus.DONE,
              }"
              >{{ progress?.status ?? LogProgressStatus.QUEUED }}</span
            >
            <div
              v-if="
                progress?.status !== LogProgressStatus.DONE && processes?.length
              "
              v-for="process in processes"
              :key="process.index"
              class="text-xs text-slate-700"
            >
              <span
                v-if="process?.status === LogProgressStatus.WORKING"
                :class="
                  process.percent < 100 ? 'text-blue-500' : 'text-green-500'
                "
              >
                {{ process.percent.toFixed(2) }}%
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
          </TableCell>
          <TableCell class="align-top">
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
</template>
