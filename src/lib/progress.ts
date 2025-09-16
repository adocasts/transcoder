export default class Progress {
  constructor(protected name: string) {}

  start() {
    this.#print(0)
  }

  update(percent: number | undefined) {
    this.#clearLast()
    this.#print(percent)
  }

  #print(percent: number | undefined) {
    process.stdout.write(`${this.name}: ${percent}%`)
  }

  #clearLast() {
    process.stdout.moveCursor(0, -1)
    process.stdout.clearLine(1)
  }
}
