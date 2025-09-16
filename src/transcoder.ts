import { InvalidArgumentsException } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { mkdir, writeFile } from 'node:fs/promises'
import FfmpegBase from './lib/ffmpeg_base.js'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'
import { resolutions, Resolutions } from './lib/resolutions.js'
import { TranscoderPlaylist } from './types/transcoder.js'

export default class Transcoder extends FfmpegBase {
  #playlist: TranscoderPlaylist[] = []

  declare source: string
  declare item: QueuedFile

  constructor(source: string, item: QueuedFile) {
    super()

    if (!this.resolutions.length) {
      throw new InvalidArgumentsException('At least one resolution is needed to transcode')
    }

    this.source = source
    this.item = item
  }

  async run() {
    for (const resolution of this.resolutions) {
      const playlist = await this.#transcode(resolution)

      if (!playlist) {
        logger.debug(`[skipping]: ${resolution}p for ${this.item.filename}; no playlist returned`)
        continue
      }

      this.#playlist.push(playlist)
    }

    return this.#buildMainPlaylist()
  }

  async #transcode(resolution: Resolutions): Promise<TranscoderPlaylist | null> {
    const resolutionName = `${resolution}p`
    const playlistName = `${resolutionName}.m3u8`
    const outputResolution = [this.item.destination, resolutionName].join('/')
    const outputPlaylist = [outputResolution, playlistName].join('/')
    const outputSegment = [outputResolution, `${resolutionName}_%03d.ts`].join('/')
    const { height, bitrate } = resolutions.get(resolution) ?? {}

    if (!height || !bitrate) {
      logger.error(`[argument error]: Invalid resolution provided: ${resolution}`)
      return null
    }

    await mkdir(outputResolution, { recursive: true })

    return new Promise((resolve) => {
      const progress = new Progress(resolutionName)
      const command = this.ffmpeg(this.source, resolve)
        .output(outputPlaylist)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('148k')
        .outputOptions([
          '-filter:v',
          `scale=-2:${height}`,
          '-preset',
          'fast',
          '-crf',
          '28',
          '-hls_time',
          '4',
          '-hls_playlist_type',
          'vod',
          '-hls_segment_filename',
          outputSegment,
        ])

      progress.start()

      command.on('progress', (event) => progress.update(event.percent))
      command.on('error', (err) => this.onFfmpegError(err, resolve))

      command.on('end', async () => {
        progress.update(100)

        resolve({
          resolution: await this.#detectPlaylistResolution(outputPlaylist),
          playlistFilename: playlistName,
          playlistPathFromMain: [resolutionName, playlistName].join('/'),
          playlistPath: outputPlaylist,
          bitrate,
        })
      })

      command.run()
    })
  }

  async #buildMainPlaylist() {
    if (!this.#playlist.length) {
      logger.info(
        `[skipping]: main playlist for ${this.item.filename}; no resolution playlists found`
      )
      return
    }

    const main = ['#EXTM3U', '#EXT-X-VERSION:3']

    for (const playlist of this.#playlist) {
      main.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bitrate * 1000},RESOLUTION=${playlist.resolution.width}x${playlist.resolution.height}`
      )
      main.push(playlist.playlistPathFromMain)
    }

    const final = main.join('\n')

    await writeFile(`${this.item.destination}/main.m3u8`, final)

    return true
  }

  async #detectPlaylistResolution(
    playlistPath: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      this.ffmpeg(playlistPath).ffprobe((err, data) => {
        if (err) {
          return reject(err)
        }

        const { width, height } = data.streams.find((stream) => stream.codec_type === 'video') ?? {}

        if (!width || !height) {
          return reject(new Error('Could not detect playlist resolution'))
        }

        resolve({ width, height })
      })
    })
  }
}
