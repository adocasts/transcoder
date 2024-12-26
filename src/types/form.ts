import type { Resolutions } from "~/lib/transcoder";
import type { TranscoderQueue } from "./transcoder";

export type Form = {
  queue: TranscoderQueue;
  resolutions: Resolutions[];
  output: string;
};

export enum Statuses {
  IDLE = "idle",
  PROCESSING = "processing",
  ERROR = "error",
}