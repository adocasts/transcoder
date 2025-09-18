import logger from '@adonisjs/core/services/logger'
import FfmpegBase from './lib/ffmpeg_base.js'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'

export default class GenerateWebp extends FfmpegBase {
  declare source: string
  declare item: QueuedFile

  constructor(source: string, item: QueuedFile) {
    super()

    this.source = source
    this.item = item
  }

  async run() {
    logger.info('Generating WEBP ...')
    return this.#generate()
  }

  async #generate(): Promise<string> {
    const output = [this.item.destination, 'video.webp'].join('/')
    const duration = await this.detectVideoDuration(this.source)

    return new Promise((resolve) => {
      const progress = new Progress('WEBP')
      const command = this.ffmpeg(this.source)
        .output(output)
        .videoCodec('libwebp')
        .videoFilter(`fps=30, scale=320:-1`)
        .setStartTime(duration > 30 ? 10 : 0)
        .duration(6)
        .outputOptions(['-preset', 'picture', '-loop', '0', '-an'])

      progress.start()

      command.on('progress', (event) => progress.update(event.percent))
      command.on('error', (err) => this.onFfmpegError(err, resolve))

      command.on('end', async () => {
        progress.update(100)
        resolve(output)
      })

      command.run()
    })
  }
}
