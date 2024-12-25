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
    const parsed: Resolutions[] = []
    const args = arg.split(',')

    for (const value of Object.values(Resolutions)) {
      const resolution = args.find((a) => a == value)
      if (resolution) parsed.push(value as Resolutions)
    }

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
    const done: string[] = []

    for (const item of this.#queue) {
      const resolutionPlaylists: TranscoderPlaylist[] = []
      const filenameLessExt = item[1].filename.split('.').shift() as string
      const outputFolder = `${this.#output}/${filenameLessExt}`

      for (const resolution of this.#resolutions) {
        logger.info(`[processing]: ${resolution}p for ${item[1].filename}`)

        const playlist = await this.#transcode(item, resolution, outputFolder)
        
        if (!playlist) {
          logger.info(`[skipping]: ${resolution}p for ${item[1].filename}; no playlist returned`)
          continue
        }

        resolutionPlaylists.push(playlist)

        logger.success(`[done]: ${resolution}p for ${item[1].filename}`)
      }

      const success = await this.#buildMainPlaylist(resolutionPlaylists, outputFolder)

      if (success) done.push(item[0])
    }

    logger.success(`[finished]: ${done.length} file(s) successfully processed`)
  }

  async #transcode([path, { filename }]: [string, TranscoderQueueFile], resolution: Resolutions, outputFolder: string): Promise<TranscoderPlaylist | null> {
    const resolutionOutput = `${outputFolder}/${resolutions.get(resolution)?.height}p`
    const outputFilenameLessExt = `${resolutionOutput}/${filename}_${resolution}`
    const outputPlaylist = `${outputFilenameLessExt}p.m3u8`
    const outputSegment = `${outputFilenameLessExt}_%03d.ts`
    const { height, bitrate } = resolutions.get(resolution) ?? {}

    if (!height || !bitrate) {
      logger.error(`[argument error]: Invalid resolution provided: ${resolution}`)
      return null
    }

    logger.info(`[creating]: ${resolution}p destination ${resolutionOutput}`)

    await mkdir(resolutionOutput, { recursive: true })

    return new Promise((resolve) => {
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
        .on('progress', (progress) => {
          logger.progress(`${path}: ${progress.percent}%`)
          logger.debug(`[progress]: ${progress.percent?.toFixed(2)}% @ frame ${progress.frames}; timemark ${progress.timemark}`)
        })
        .on('start', () => {
          logger.info(`[transcoding started]: ${resolution}p for ${filename}`)
          logger.progress(`${path}: 0%`)
        })
        .on('end', async () => {
          logger.info(`[transcoding completed]: ${resolution}p for ${filename}`)
          logger.progress(`${path}: 100%`)
          
          resolve({
            resolution: await this.#detectPlaylistResolution(outputPlaylist),
            playlistFilename: outputPlaylist.split('/').pop() as string,
            playlistPath: outputPlaylist,
            bitrate,
          })
        })
        .on('error', (err) => {
          logger.progress(`${path}: ERROR`)
          logger.error(`[ffmpeg error]: ${err.message}`)
          resolve(null)
        })
        .run()
    })
  }

  async #buildMainPlaylist(playlists: TranscoderPlaylist[], outputFolder: string) {
    if (!playlists.length) {
      logger.info(`[skipping]: main playlist for ${outputFolder}; no resolution playlists found`)
      return
    }

    const main = ['#EXTM3U', '#EXT-X-VERSION:3']

    for (const playlist of playlists) {
      logger.debug(`[playlist]: ${playlist.resolution.height}p for ${playlist.playlistFilename}`)
      main.push(`#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bitrate * 1000},RESOLUTION=${playlist.resolution.width}x${playlist.resolution.height}`);
      main.push(playlist.playlistFilename);
    }

    const final = main.join('\n')

    logger.debug(`[creating]: main playlist ${outputFolder}/master.m3u8`)

    await writeFile(`${outputFolder}/master.m3u8`, final)

    logger.success(`[done]: main playlist ${outputFolder}/master.m3u8`)

    return true
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