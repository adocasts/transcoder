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
  progress?: { percent: number; file: string; status: LogProgressStatus }
  step?: { index: number; process: string; file: string; percent: number; status: LogProgressStatus }
}

export default class ParsedLog implements ParsedLogContract {
  declare type: LogTypes
  declare message: string
  declare progress?: { percent: number; file: string; status: LogProgressStatus }
  declare step?: { index: number; process: string; file: string; percent: number; status: LogProgressStatus }

  constructor(log?: string) {
    if (!log) return
    this.type = this.#getType(log)
    this.message = this.#getMessage(log)
    this.step = this.#getStep(log)
    this.progress = this.#getProgress()
  }

  static stderr(log: string) {
    const parsed = new ParsedLog()
    parsed.type = LogTypes.ERROR
    parsed.message = log
    return parsed
  }

  #getType(log: string) {
    const lowered = log.toLowerCase()
    
    if (lowered.startsWith('error:')) return LogTypes.ERROR
    if (lowered.startsWith('info:')) return LogTypes.INFO
    if (lowered.startsWith('success:')) return LogTypes.SUCCESS
    if (lowered.startsWith('progress:')) return LogTypes.PROGRESS
    if (lowered.startsWith('step@')) return LogTypes.STEP

    return LogTypes.DEBUG
  }

  #getStep(log: string) {
    if (this.type !== LogTypes.STEP) return

    const [prefix, ...json] = log.split(':')
    const [_, step] = prefix.split('@')
    console.log({ step, json })
    const { process, file } = JSON.parse(json.join(':')) as { process: string; file: string }

    return { 
      index: Number(step),
      process,
      file,
      status: LogProgressStatus.QUEUED,
      percent: 0
    }
  }

  #getMessage(log: string) {
    return log
      .replace(`${this.type.toUpperCase()}:`, '')
      .replace(`${this.type.toUpperCase()}@${this.step}`, '')
      .replace('Error: ', '')
      .trim()
  }

  #getProgress() {
    if (this.type !== LogTypes.PROGRESS) return

    const [file, percentage] = this.message.split(':')
    
    if (!percentage || percentage.trim() === 'ERROR') {
      return {
        percent: 0,
        file: file.trim(),
        status: LogProgressStatus.ERROR
      }
    }

    const percent = Number(percentage.replace('%', '').trim())
    let status = LogProgressStatus.QUEUED

    if (percent > 0 && percent < 100) status = LogProgressStatus.WORKING
    if (percent === 100) status = LogProgressStatus.DONE

    return {
      percent,
      status,
      file: file.trim()
    }
  }
}
