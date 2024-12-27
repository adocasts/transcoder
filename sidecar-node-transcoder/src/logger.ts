import { LogProgressStatus, LogTypes } from '../../src/lib/parsed_log'
import type { Progress, Step } from '../../src/types/transcoder'

class Logger {
  error(message: string) {
    console.log(JSON.stringify([LogTypes.ERROR, message]))
  }

  info(message: string) {
    console.log(JSON.stringify([LogTypes.INFO, message]))
  }

  debug(message: string) {
    console.log(JSON.stringify([LogTypes.DEBUG, message]))
  }

  success(message: string) {
    console.log(JSON.stringify([LogTypes.SUCCESS, message]))
  }

  progress(data: Progress) {
    if (!data.status) {
      if (data.percent === 100) data.status = LogProgressStatus.DONE
      else if (data.percent) data.status = LogProgressStatus.WORKING
      else data.status = LogProgressStatus.QUEUED
    }

    console.log(JSON.stringify([LogTypes.PROGRESS, data]))
  }

  step(data: Step) {
    console.log(JSON.stringify([LogTypes.STEP, data]))
  }
}

const logger = new Logger()
export default logger
