<script setup lang="ts">
import Table from "./ui/table/Table.vue";
import TableHeader from "./ui/table/TableHeader.vue";
import TableRow from "./ui/table/TableRow.vue";
import TableHead from "./ui/table/TableHead.vue";
import TableBody from "./ui/table/TableBody.vue";
import TableCell from "./ui/table/TableCell.vue";
import { Form } from "~/types/form";
import { LogProgressStatus } from "~/lib/parsed_log";
import { CornerDownRight, Loader2, X } from "lucide-vue-next";
import Button from "./ui/button/Button.vue";
import QueueProgressMain from "./QueueProgressMain.vue";
import QueueProgressStep from "./QueueProgressStep.vue";

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
              class="text-xs flex items-center text-slate-700"
            >
              <CornerDownRight class="w-3 h-3 -mt-0.5 mr-2" />
              {{ process.process }}
            </div>
          </TableCell>
          <TableCell class="align-top">{{ extname }}</TableCell>
          <TableCell class="align-top">{{ bytesToSize(bytes) }}</TableCell>
          <TableCell>
            <QueueProgressMain :progress="progress" :processes="processes">
              <QueueProgressStep
                v-for="process in processes"
                :key="process.index"
                :process="process"
              />
            </QueueProgressMain>
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
