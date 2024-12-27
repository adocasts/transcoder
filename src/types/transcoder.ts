import type { LogProgressStatus } from "../lib/parsed_log";

export type TranscoderQueueFile = {
  filename: string;
  extname: string;
  bytes: number;
  progress?: Progress
  processes?: Step[]
};

export type TranscoderQueue = Map<string, TranscoderQueueFile>;

export type Progress = { percent?: number; file: string; status?: LogProgressStatus }

export type Step = { index: number; process: string; file: string; percent?: number; status?: LogProgressStatus }