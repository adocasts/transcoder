import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import ffmpeg from 'fluent-ffmpeg'
import { Resolutions } from './resolutions.js'

export default abstract class FfmpegBase {
  resolutions = env.get('RESOLUTIONS').split(',') as Resolutions[]

  ffmpeg(path: string) {
    return ffmpeg(decodeURI(path))
  }

  onFfmpegError(err: Error, resolve: (value: null) => void) {
    logger.error(`[ffmpeg error]: ${err.message}`)
    resolve(null)
  }

  async detectVideoDuration(path: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg(path).ffprobe((err, data) => {
        if (err) {
          return reject(err)
        }

        const { duration } = data.streams.find((stream) => stream.codec_type === 'video') ?? {}

        if (!duration) {
          return reject(new Error('Could not detect playlist resolution'))
        }

        resolve(Number(duration))
      })
    })
  }
}
