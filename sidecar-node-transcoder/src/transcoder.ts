import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import logger from "./logger.js";
import { mkdir, writeFile } from "node:fs/promises";
import { Resolutions, resolutions, allowedExtensions } from '../../src/lib/transcoder.js'

export type TranscoderQueueFile = { filename: string; extname: string }
export type TranscoderQueue = Map<string, TranscoderQueueFile>

export type TranscoderOptions = {
  queue: TranscoderQueue
  resolutions: Resolutions[]
  output: string
  includeMp4: boolean
  includeWebp: boolean
}

export type TranscoderPlaylist = {
  resolution: { width: number; height: number }
  bitrate: number
  playlistFilename: string
  playlistPathFromMain: string
  playlistPath: string
}


export default class Transcoder {
  static resolutions = resolutions

  #command: FfmpegCommand | null = null
  #queue: TranscoderQueue = new Map()
  #resolutions: Resolutions[] = []
  #output: string
  #includeMp4: boolean
  #includeWebp: boolean

  constructor({ queue, resolutions, output, includeMp4, includeWebp }: TranscoderOptions) {
    this.#queue = queue
    this.#resolutions = resolutions
    this.#output = output
    this.#includeMp4 = includeMp4
    this.#includeWebp = includeWebp
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
        logger.error(`unsupported file type, file will be skipped: ${file}`)
        continue;
      }

      queue.set(file, { filename, extname })
    }

    return queue
  }

  kill() {
    if (!this.#command) {
      logger.debug('[skipped]: no ffmpeg process to kill')
      return
    }

    this.#command.kill("SIGTERM")

    logger.debug('[killed]: ffmpeg process')
  }

  async process() {
    const done: string[] = []

    for (const item of this.#queue) {
      const filenameLessExt = item[1].filename.split('.').shift() as string
      const outputFolder = `${this.#output}/${filenameLessExt}`
      const success = await this.#transcodeResolutions(item, outputFolder)

      if (success) done.push(item[0])

      await this.#compressOriginal(item, outputFolder)
      await this.#generateAnimatedWebp(item, outputFolder)
    }

    logger.success(`[finished]: ${done.length} file(s) successfully processed`)
  }

  async #transcodeResolutions([path, item]: [string, TranscoderQueueFile], outputFolder: string) {
    if (!this.#resolutions.length) return true

    const resolutionPlaylists: TranscoderPlaylist[] = []

    for (const resolution of this.#resolutions) {
      logger.info(`[started]: processing ${resolution}p for ${item.filename}`)
      logger.step({ index: 1, process: `Transcoding ${resolution}p`, file: path })

      const playlist = await this.#transcode([path, item], resolution, outputFolder)
      
      if (!playlist) {
        logger.info(`[skipping]: ${resolution}p for ${item.filename}; no playlist returned`)
        continue
      }

      resolutionPlaylists.push(playlist)

      logger.success(`[completed]: processing ${resolution}p for ${item.filename}`)
    }

    return this.#buildMainPlaylist(resolutionPlaylists, outputFolder)
  }

  async #transcode([path, { filename }]: [string, TranscoderQueueFile], resolution: Resolutions, outputFolder: string): Promise<TranscoderPlaylist | null> {
    const resolutionOutput = `${outputFolder}/${resolution}p`
    const filenameLessExt = filename.split('.').shift() as string
    const outputFilenameLessExt = `${filenameLessExt}_${resolution}`
    const outputPlaylist = `${resolutionOutput}/${outputFilenameLessExt}p.m3u8`
    const outputSegment = `${resolutionOutput}/${outputFilenameLessExt}_%03d.ts`
    const outputPlaylisFromMain = `${resolution}p/${outputFilenameLessExt}p.m3u8`
    const { height, bitrate } = resolutions.get(resolution) ?? {}

    if (!height || !bitrate) {
      logger.error(`[argument error]: Invalid resolution provided: ${resolution}`)
      return null
    }

    await mkdir(resolutionOutput, { recursive: true })
    
    return new Promise((resolve) => {
      this.#command = ffmpeg(decodeURI(path))
        .output(outputPlaylist)
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

      this.#command.on('progress', (progress) => {
        logger.progress({ file: path, percent: progress.percent })
        logger.debug(`[progress]: ${progress.percent?.toFixed(2)}% @ frame ${progress.frames}; timemark ${progress.timemark}`)
      })

      this.#command.on('start', () => {
        logger.info(`[started]: transcoding ${resolution}p for ${filename}`)
        logger.progress({ file: path, percent: 0 })
      })

      this.#command.on('end', async () => {
        logger.success(`[completed]: transcoding ${resolution}p for ${filename}; output ${outputPlaylist}`)
        logger.progress({ file: path, percent: 100 })
        resolve({
          resolution: await this.#detectPlaylistResolution(outputPlaylist),
          playlistFilename: outputPlaylist.split('/').pop() as string,
          playlistPathFromMain: outputPlaylisFromMain,
          playlistPath: outputPlaylist,
          bitrate,
        })
      })
      
      this.#command.on('error', (err) => this.#onFfmpegError(path, err, resolve))
      this.#command.run()
    })
  }

  async #compressOriginal([path, { filename }]: [string, TranscoderQueueFile], outputFolder: string): Promise<string | null> {
    if (!this.#includeMp4) return null

    const filenameLessExt = filename.split('.').shift() as string
    const output = `${outputFolder}/${filenameLessExt}.mp4`
    const resolution = this.#resolutions.length ? Math.max(...this.#resolutions) : Resolutions.P2160
    const { height, bitrate } = resolutions.get(resolution)!

    logger.step({ index: 2, process: `Compressing MP4`, file: path })

    return new Promise((resolve) => {
      this.#command = ffmpeg(decodeURI(path))
        .output(output)
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
        ])

      this.#command.on('progress', (progress) => {
        logger.progress({ file: path, percent: progress.percent })
        logger.debug(`[progress]: ${progress.percent?.toFixed(2)}% @ frame ${progress.frames}; timemark ${progress.timemark}`)
      })
      
      this.#command.on('start', () => {
        logger.info(`[started]: compressing ${height}p for ${filename}`)
        logger.progress({ file: path, percent: 0 })
      })
      
      this.#command.on('end', async () => {
        logger.progress({ file: path, percent: 100 })
        logger.success(`[completed]: compressing ${height}p for ${filename}; output ${output}`)
        resolve(output)
      })
      
      this.#command.on('error', (err) => this.#onFfmpegError(path, err, resolve))
      this.#command.run()
    })
  }

  async #generateAnimatedWebp([path, { filename }]: [string, TranscoderQueueFile], outputFolder: string): Promise<string | null> {
    if (!this.#includeWebp) return null

    const filenameLessExt = filename.split('.').shift() as string
    const output = `${outputFolder}/${filenameLessExt}.webp`
    const duration = await this.#detectVideoDuration(path)

    logger.step({ index: 3, process: `Generating Animated WebP`, file: path })

    return new Promise((resolve) => {
      this.#command = ffmpeg(decodeURI(path))
        .output(output)
        .videoCodec('libwebp')
        .videoFilter(`fps=30, scale=320:-1`)
        .setStartTime(duration > 30 ? 10 : 0)
        .duration(6)
        .outputOptions([
          '-preset', 'picture',
          '-loop', '0',
          '-an',
        ])

      this.#command.on('progress', (progress) => {
        // get percentage done from progress timemark in format HH:MM:SS.000 compared to duration
        const percent = (Number(progress.timemark.split(':').pop()) / 6) * 100
        logger.progress({ file: path, percent })
        logger.debug(`[progress]: ${percent?.toFixed(2)}% @ frame ${progress.frames}; timemark ${progress.timemark}`)
      })

      this.#command.on('start', () => {
        logger.info(`[started]: generating animated webp for ${filename}`)
        logger.progress({ file: path, percent: 0 })
      })

      this.#command.on('end', async () => {
        logger.progress({ file: path, percent: 100 })
        logger.success(`[completed]: generating animated webp for ${filename}; output ${output}`)
        resolve(output)
      })

      this.#command.on('error', (err) => this.#onFfmpegError(path, err, resolve))
      this.#command.run()
    })
  }

  #onFfmpegError(file: string, err: Error, resolve: (value: null) => void) {
    logger.progress({ file, percent: -1 })
    logger.error(`[ffmpeg error]: ${err.message}`)
    resolve(null)
  }

  async #buildMainPlaylist(playlists: TranscoderPlaylist[], outputFolder: string) {
    if (!playlists.length) {
      logger.info(`[skipping]: main playlist for ${outputFolder}; no resolution playlists found`)
      return
    }

    logger.info(`[started]: generating main playlist ${outputFolder}/master.m3u8`);

    const main = ['#EXTM3U', '#EXT-X-VERSION:3']

    for (const playlist of playlists) {
      logger.debug(`[playlist]: ${playlist.resolution.height}p for ${playlist.playlistPathFromMain}`)
      main.push(`#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bitrate * 1000},RESOLUTION=${playlist.resolution.width}x${playlist.resolution.height}`);
      main.push(playlist.playlistPathFromMain);
    }

    const final = main.join('\n')

    await writeFile(`${outputFolder}/master.m3u8`, final)

    logger.success(`[completed]: generating main playlist ${outputFolder}/master.m3u8`)

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

  async #detectVideoDuration(path: string): Promise<number> {
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
