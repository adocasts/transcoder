export enum LogTypes {
  ERROR = 'error',
  INFO = 'info',
  SUCCESS = 'success',
  PROGRESS = 'progress',
  DEBUG = 'debug',
}

export default class ParsedLog {
  declare type: LogTypes
  declare message: string
  declare progress?: { percent: number; file: string }

  constructor(log: string) {
    this.type = this.#getType(log)
    this.message = this.#getMessage(log)
    this.progress = this.#getProgress()
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

    return {
      percent: Number(percentage.replace('%', '').trim()),
      file: file.trim()
    }
  }
}
