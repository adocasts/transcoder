import logger from '@adonisjs/core/services/logger'
import FfmpegBase from './lib/ffmpeg_base.js'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'
import { resolutions, Resolutions } from './lib/resolutions.js'

export default class Compressor extends FfmpegBase {
  declare source: string
  declare item: QueuedFile

  constructor(source: string, item: QueuedFile) {
    super()

    this.source = source
    this.item = item
  }

  async run() {
    logger.info('Compressing ...')
    return this.#compress()
  }

  async #compress(): Promise<string> {
    const output = [this.item.destination, 'video.mp4'].join('/')
    const resolution = this.#getMaxResolution()
    const { height } = resolutions.get(resolution) ?? {}

    return new Promise((resolve) => {
      const progress = new Progress('Compressing')
      const command = this.ffmpeg(this.source)
        .output(output)
        .videoCodec('libx265')
        .audioCodec('aac')
        .audioBitrate('148k')
        .outputOptions([
          '-filter:v',
          `scale=-2:${height}`,
          '-preset',
          'fast',
          '-crf',
          '26',
          '-tag:v',
          'hvc1',
          '-x265-params',
          'profile=main10',
        ])

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

  #getMaxResolution() {
    const resnumbers = this.resolutions.map((res) => Number(res))
    return this.resolutions.length
      ? (Math.max(...resnumbers).toString() as Resolutions)
      : Resolutions.P2160
  }
}
