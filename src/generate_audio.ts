import logger from '@adonisjs/core/services/logger'
import { unlink } from 'node:fs/promises'
import FfmpegBase from './lib/ffmpeg_base.js'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'

export default class GenerateAudio extends FfmpegBase {
  declare source: string
  declare item: QueuedFile

  success = false

  constructor(source: string, item: QueuedFile) {
    super()

    this.source = source
    this.item = item
  }

  get output() {
    return [this.item.destination, 'audio.mp4'].join('/')
  }

  async run() {
    logger.info('Extracting audio ...')
    return this.#compress()
  }

  async destroy() {
    if (!this.success) {
      logger.info('Skipping audio destroy, creation of file did not succeed')
      return
    }

    logger.info(`Deleting: ${this.output}`)

    await unlink(this.output)
  }

  async #compress(): Promise<string> {
    return new Promise((resolve) => {
      const progress = new Progress('Audio Extraction')
      const command = this.ffmpeg(this.source)
        .output(this.output)
        .audioCodec('aac')
        .audioBitrate('148k')
        .noVideo()

      progress.start()

      command.on('progress', (event) => progress.update(event.percent))
      command.on('error', (err) => this.onFfmpegError(err, resolve))

      command.on('end', async () => {
        progress.update(100)

        this.success = true

        resolve(this.output)
      })

      command.run()
    })
  }
}
