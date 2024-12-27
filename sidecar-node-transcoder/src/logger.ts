class Logger {
  error(message: string) {
    console.log('ERROR: '.concat(message))
  }

  info(message: string) {
    console.log('INFO: '.concat(message))
  }

  debug(message: string) {
    console.log('DEBUG: '.concat(message))
  }

  success(message: string) {
    console.log('SUCCESS: '.concat(message))
  }

  progress(message: string) {
    console.log('PROGRESS: '.concat(message))
  }

  step(index: number, message: string) {
    console.log(`STEP@${index}: `.concat(message))
  }
}

const logger = new Logger()
export default logger
