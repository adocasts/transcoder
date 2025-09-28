export default class Progress {
  constructor(protected name: string) { }

  #isTTY = process.stdout.isTTY // Check if we are writing to a real terminal

  start() {
    this.#print(0)
  }

  update(percent: number | undefined) {
    if (percent === 100) {
      return this.stop()
    }

    this.#print(percent)
  }

  // Added a stop method to leave a clean final line
  stop() {
    if (this.#isTTY) {
      process.stdout.write('\r') // Move cursor back to start of line
      process.stdout.clearLine(0) // Clear the line content
    }
    // Optionally print a finished message
    process.stdout.write(`${this.name}: Complete\n`)
  }

  #print(percent: number | undefined) {
    const text = `${this.name}: ${Math.round(percent || 0)}%`

    if (this.#isTTY) {
      // Use \r to return the cursor to the beginning of the current line
      // and overwrite the previous text.
      process.stdout.write(`\r${text}`)
    } else {
      // If not a TTY (e.g., piped to a file or another process),
      // just print a status update with a newline.
      process.stdout.write(`${text}\n`)
    }
  }
}
