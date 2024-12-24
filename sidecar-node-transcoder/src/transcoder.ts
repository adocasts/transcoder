import ffmpeg from "fluent-ffmpeg";
import logger from "./logger.js";
import { mkdir, writeFile } from "node:fs/promises";
import { Resolutions, resolutions, allowedExtensions } from '../../src/lib/transcoder.js'

export type TranscoderQueueFile = { filename: string; extname: string }
export type TranscoderQueue = Map<string, TranscoderQueueFile>

export type TranscoderOptions = {
  queue: TranscoderQueue
  resolutions: Resolutions[]
  output: string
}

export type TranscoderPlaylist = {
  resolution: { width: number; height: number }
  bitrate: number
  playlistFilename: string
  playlistPath: string
}


export default class Transcoder {
  static resolutions = resolutions

  #queue: TranscoderQueue = new Map()
  #resolutions: Resolutions[] = []
  #output: string

  constructor({ queue, resolutions, output }: TranscoderOptions) {
    this.#queue = queue
    this.#resolutions = resolutions
    this.#output = output
  }

  static parseResolutions(arg: string) {
    const args = arg.split(',')
    const parsed = args.map((a) => Resolutions[a as keyof typeof Resolutions])

    return parsed
  }

  static parseFiles(arg: string): TranscoderQueue {
    const files = arg.split(',')
    const queue = new Map<string, TranscoderQueueFile>()
    
    for (const file of files) {
      const filename = file.split("/").pop() as string;
      const extname = filename.split(".").pop() as string;

      if (!allowedExtensions.includes(extname)) {
        logger.error(`unsupported file will be skipped: ${file}`)
        continue;
      }

      queue.set(file, { filename, extname })
    }

    return queue
  }

  async process() {
    for (const item of this.#queue) {
      const resolutionPlaylists: TranscoderPlaylist[] = []
      const filenameLessExt = item[1].filename.split('.').shift() as string
      const outputFolder = `${this.#output}/${filenameLessExt}`

      for (const resolution of this.#resolutions) {
        logger.debug(`processing ${item[1].filename} to ${outputFolder}`)

        const playlist = await this.#transcode(item, resolution, outputFolder)
        
        resolutionPlaylists.push(playlist)
      }

      this.#buildMainPlaylist(resolutionPlaylists, outputFolder)
    }
  }

  async #transcode([path, { filename }]: [string, TranscoderQueueFile], resolution: Resolutions, outputFolder: string): Promise<TranscoderPlaylist> {
    const resolutionOutput = `${outputFolder}/${resolutions.get(resolution)?.height}p`
    const outputFilenameLessExt = `${resolutionOutput}/${filename}_${resolution}`
    const outputPlaylist = `${outputFilenameLessExt}p.m3u8`
    const outputSegment = `${outputFilenameLessExt}_%03d.ts`
    const { height, bitrate } = resolutions.get(resolution) ?? {}

    if (!height || !bitrate) {
      throw new Error(`Invalid resolution provided: ${resolution}`)
    }

    logger.debug(`transcoding ${path} to ${outputPlaylist}`)

    await mkdir(outputFolder, { recursive: true })

    return new Promise((resolve, reject) => {
      ffmpeg(decodeURI(path))
        .videoCodec('libx264')
        .videoBitrate(`${bitrate}k`)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions([
          '-filter:v', `scale=-2:${height}`,
          '-preset', 'veryfast',
          '-crf', '20',
          '-g', '48',
          '-keyint_min', '48',
          '-sc_threshold', '0',
          '-hls_time', '4',
          '-hls_playlist_type', 'vod',
          '-hls_segment_filename', outputSegment,
        ])
        .output(outputPlaylist)
        .on('start', () => logger.debug('ffmpeg started'))
        .on('progress', (progress) => logger.progress(`${path}: ${progress.percent}%`))
        .on('end', async () => {
          logger.debug('ffmpeg finished')
          
          resolve({
            resolution: await this.#detectPlaylistResolution(outputPlaylist),
            playlistFilename: outputPlaylist.split('/').pop() as string,
            playlistPath: outputPlaylist,
            bitrate,
          })
        })
        .on('error', (err) => {
          logger.error(`ffmpeg error: ${err.message}`)
          reject(err)
        })
        .run()
    })
  }

  async #buildMainPlaylist(playlists: TranscoderPlaylist[], outputFolder: string) {
    const main = ['#EXTM3U', '#EXT-X-VERSION:3']

    for (const playlist of playlists) {
      logger.debug(`generating ${playlist.resolution.height}p playlist. Path: ${playlist.playlistPath}`)
      main.push(`#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bitrate * 1000},RESOLUTION=${playlist.resolution.width}x${playlist.resolution.height}`);
      main.push(playlist.playlistFilename);
    }

    const final = main.join('\n')

    logger.debug(`writing ${outputFolder}/master.m3u8`)

    await writeFile(`${outputFolder}/master.m3u8`, final)
  }

  async #detectPlaylistResolution(playlistPath: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg(playlistPath).ffprobe((err, data) => {
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