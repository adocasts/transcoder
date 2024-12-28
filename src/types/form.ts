import type { Resolutions } from "~/lib/transcoder";
import type { TranscoderQueue } from "./transcoder";

export type Form = {
  queue: TranscoderQueue;
  output: string;
  useCuid: boolean;
  includeWebp: boolean;
  includeMp4: boolean;
  resolutions: Resolutions[];
};

export enum Statuses {
  IDLE = "idle",
  PROCESSING = "processing",
  ERROR = "error",
}