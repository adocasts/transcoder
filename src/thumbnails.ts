import { writeFile } from 'node:fs/promises'
import FfmpegBase from './lib/ffmpeg_base.js'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'

export default class Thumbnails extends FfmpegBase {
  declare source: string
  declare item: QueuedFile

  #filename = 'storyboard.jpg'
  #interval = 2
  #thumbnail = {
    width: 160,
    height: 90,
  }

  constructor(source: string, item: QueuedFile) {
    super()

    this.source = source
    this.item = item
  }

  async run() {
    const duration = await this.detectVideoDuration(this.source)
    const grid = this.#calculateTileGrid(duration)

    await this.#generateSprite(grid)
    await this.#generateVtt(grid)
  }

  async #generateSprite(grid: { columns: number; rows: number; count: number }) {
    return new Promise((resolve) => {
      const progress = new Progress('thumbanils')
      const fps = 1 / this.#interval

      progress.start()

      this.ffmpeg(this.source)
        .inputOptions(['-skip_frame', 'nokey'])
        .videoFilters([
          `fps=${fps}`,
          `scale=${this.#thumbnail.width}:${this.#thumbnail.height}:flags=lanczos`,
          `tile=${grid.columns}x${grid.rows}`,
        ])
        .outputOptions(['-frames:v 1', '-q:v 5'])
        .on('end', () => {
          progress.update(100)
          resolve(true)
        })
        .on('error', (err) => this.onFfmpegError(err, resolve))
        .save(`${this.item.destination}/${this.#filename}`)
    })
  }

  async #generateVtt(grid: { columns: number; rows: number; count: number }) {
    const destination = [this.item.destination, 'thumbnails.vtt'].join('/')
    let content = 'WEBVTT\n\n'

    for (let i = 0; i < grid.count; i++) {
      const start = new Date(i * this.#interval * 1000).toISOString().substr(11, 12)
      const end = new Date((i + 1) * this.#interval * 1000).toISOString().substr(11, 12)

      // Calculate position in the grid
      const x = (i % grid.columns) * this.#thumbnail.width
      const y = Math.floor(i / grid.columns) * this.#thumbnail.height

      content += `${start} --> ${end}\n`
      content += `storyboard.jpg#xywh=${x},${y},${this.#thumbnail.width},${this.#thumbnail.height}\n\n`
    }

    await writeFile(destination, content)
  }

  #calculateTileGrid(duration: number) {
    const count = Math.ceil(duration / this.#interval)
    const columns = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / columns)

    return { columns, rows, count }
  }
}
