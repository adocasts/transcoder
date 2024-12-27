import { Progress, Step } from "../types/transcoder";

export enum LogTypes {
  ERROR = 'error',
  INFO = 'info',
  SUCCESS = 'success',
  PROGRESS = 'progress',
  DEBUG = 'debug',
  STEP = 'step',
}

export enum LogProgressStatus {
  QUEUED = 'Queued',
  WORKING = 'Working',
  DONE = 'Done',
  ERROR = 'Error',
}

export interface ParsedLogContract {
  type: LogTypes
  message: string
  progress?: Progress
  step?: Step
}

export default class ParsedLog implements ParsedLogContract {
  declare type: LogTypes
  declare message: string
  declare progress?: Progress
  declare step?: Step

  constructor(log?: string) {
    if (!log) return
    
    if (!log.startsWith('[')) return ParsedLog.stderr(log)

    const [type, data] = JSON.parse(log) as [LogTypes, unknown]

    switch (type) {
      case LogTypes.PROGRESS:
        this.type = LogTypes.PROGRESS
        this.progress = data as Progress
        break
      case LogTypes.STEP:
        this.type = LogTypes.STEP
        this.step = data as Step
        break
      default:
        this.type = type
        this.message = data as string
        break
    }
  }

  static stderr(log: string) {
    const parsed = new ParsedLog()
    parsed.type = LogTypes.ERROR
    parsed.message = log
    return parsed
  }
}
