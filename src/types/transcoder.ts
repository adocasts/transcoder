import type { LogProgressStatus } from "~/lib/parsed_log";

export type TranscoderQueueFile = {
  filename: string;
  extname: string;
  bytes: number;
  progress?: { percent: number; file: string; status: LogProgressStatus };
  processes?: { process: string; file: string; index: number; percent: number; status: LogProgressStatus }[]
};

export type TranscoderQueue = Map<string, TranscoderQueueFile>;