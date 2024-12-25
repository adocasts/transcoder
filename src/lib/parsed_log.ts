export enum LogTypes {
  ERROR = 'error',
  INFO = 'info',
  SUCCESS = 'success',
  PROGRESS = 'progress',
  DEBUG = 'debug',
}

export enum LogProgressStatus {
  QUEUED = 'Queued',
  WORKING = 'Working',
  DONE = 'Done',
  ERROR = 'Error',
}

export default class ParsedLog {
  declare type: LogTypes
  declare message: string
  declare progress?: { percent: number; file: string; status: LogProgressStatus }

  constructor(log?: string) {
    if (!log) return
    this.type = this.#getType(log)
    this.message = this.#getMessage(log)
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

    return LogTypes.DEBUG
  }

  #getMessage(log: string) {
    return log
      .replace(`${this.type.toUpperCase()}:`, '')
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
