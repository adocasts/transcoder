import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import logger from "./logger.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Resolutions, resolutions, allowedExtensions } from '../../src/lib/transcoder.js'
import { createId as cuid } from '@paralleldrive/cuid2'
import { exec, spawn } from "node:child_process"

export type TranscoderQueueFile = { filename: string; extname: string }
export type TranscoderQueue = Map<string, TranscoderQueueFile>

export type TranscoderOptions = {
  queue: TranscoderQueue
  resolutions: Resolutions[]
  output: string
  includeMp4: boolean
  includeWebp: boolean
  includeTranscription: boolean
  prefixSeparator: string
  useCuid: boolean
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
  #includeTranscription: boolean
  #prefixSeparator: string
  #useCuid: boolean
  #replacements = new Map([
    ['Adonis Jazz', 'AdonisJS'],
    ['Find.js', 'VineJS'],
    ['Donis', 'Adonis'],
    ['Adacast', 'Adocasts'],
    ['Adonis JS', 'AdonisJS'],
    ['Tailwind CSS', 'TailwindCSS'],
    ['Alpine.js', 'AlpineJS'],
    ['Edge JS', 'EdgeJS'],
    ['X data', 'x-data'],
    ['X show', 'x-show'],
    ['X if', 'x-if'],
    ['Edge.js', 'EdgeJS'],
    ['Adonis.js', 'AdonisJS'],
  ])

  constructor({ queue, resolutions, output, includeMp4, includeWebp, includeTranscription, prefixSeparator, useCuid }: TranscoderOptions) {
    this.#queue = queue
    this.#resolutions = resolutions
    this.#output = output
    this.#includeMp4 = includeMp4
    this.#includeWebp = includeWebp
    this.#includeTranscription = includeTranscription
    this.#prefixSeparator = prefixSeparator
    this.#useCuid = useCuid
  }

  // #region Static Methods

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

  // #endregion

  // #region Process Management

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
      const outputFolder = this.#getOutputFolder(item[1])

      await mkdir(outputFolder, { recursive: true })

      const success = await this.#transcodeResolutions(item, outputFolder)

      if (success) done.push(item[0])

      await this.#compressOriginal(item, outputFolder)
      await this.#generateAnimatedWebp(item, outputFolder)
      await this.#transcribe(item, outputFolder)
      await this.#translateTranscription(item, outputFolder)
    }

    logger.success(`[finished]: ${done.length} file(s) successfully processed`)
  }

  // #region Process Steps

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
        // .videoBitrate(`${bitrate}k`)
        .audioCodec('aac')
        .audioBitrate('148k')
        .outputOptions([
          '-filter:v', `scale=-2:${height}`,
          '-preset', 'fast',
          '-crf', '28',
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

    const output = `${outputFolder}/video.mp4`
    const resolution = this.#resolutions.length ? Math.max(...this.#resolutions) : Resolutions.P2160
    const { height } = resolutions.get(resolution)!

    logger.step({ index: 2, process: `Compressing MP4`, file: path })

    return new Promise((resolve) => {
      this.#command = ffmpeg(decodeURI(path))
        .output(output)
        .videoCodec('libx265')
        .audioCodec('aac')
        .audioBitrate('148k')
        .outputOptions([
          '-filter:v', `scale=-2:${height}`,
          '-preset', 'fast',
          '-crf', '28',
          '-tag:v', 'hvc1',
          '-x265-params', 'profile=main10'
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

    const output = `${outputFolder}/video.webp`
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

  async #transcribe([path, { filename }]: [string, TranscoderQueueFile], outputFolder: string): Promise<string | null> {
    if (!this.#includeTranscription) return null

    logger.step({ index: 4, process: `Transcribing`, file: path })

    // use compress mp4 if enabled, otherwise use original video
    const source = this.#includeMp4 ? `${outputFolder}/video.mp4` : path

    logger.progress({ file: path, percent: 0 })

    return new Promise((resolve) => {
      const whisperArgs = [
        `"${source}"`,
        '--output_dir', `"${outputFolder}"`,
        '--output_format', 'all',
        '--model', 'large-v2',
        '--language', 'en',
        '--verbose', 'False'
      ]

      logger.info(`[started]: transcribing ${filename}`)
      logger.info(`[note]: This may take a while depending on your hardware and file size.`)

      // execute the command using `spawn`
      const whisperProcess = spawn('whisper', whisperArgs, { shell: true });

      // capture stdout data in real-time
      whisperProcess.stdout.on('data', (data) => {
        logger.debug('[stdout] ' + data.toString())
      });

      // capture stderr data in real-time
      whisperProcess.stderr.on('data', (data) => {
        if (data.includes('%')) {
          const percent = Number(data.toString().split('|').at(0).replace('%', '').trim())
          logger.progress({ file: path, percent })
        }
        logger.debug(data.toString())
      });

      // `spawn` emits a 'close' event when the process finishes
      whisperProcess.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`[error]: Whisper process exited with code ${code}. Transcription failed.`);
          resolve(null)
          return
        }

        logger.success(`[completed]: transcribing ${filename}; post-processing...`)

        const srtFinal = await this.#transcribeCleanUp(path, outputFolder, filename)

        resolve(srtFinal)
      })

      // handle errors if the command itself cannot be executed
      whisperProcess.on('error', (err) => {
        logger.error(`[error]: Failed to start the whisper process. Error: ${err.message}`)
        resolve(null)
      });
    })
  }

  async #transcribeCleanUp(path: string, outputFolder: string, filename: string): Promise<string | null> {
    const srtFilename = this.#includeMp4 ? 'video' : filename

    const renameAndCleanUpCommand = `
      mv "${outputFolder}/${srtFilename}.srt" "${outputFolder}/en.srt" &&
      rm "${outputFolder}"/*.{vtt,tsv,json}
    `

    return new Promise((resolve) => {
      // execute the post-processing command after the main process finishes
      exec(renameAndCleanUpCommand, async (error) => {
        if (error) {
          logger.error(`[post-processing error]: ${error.message}`)
          logger.progress({ file: path, percent: 100 })
          resolve(null)
          return
        }

        await this.#transcribeApplyReplacements(outputFolder, 'en.srt')
        await this.#transcribeApplyReplacements(outputFolder, `${srtFilename}.txt`)

        logger.info(`[completed]: post-processing and clean up`)
        logger.progress({ file: path, percent: 100 })

        resolve(`${outputFolder}/en.srt`)
      })
    })
  }

  async #transcribeApplyReplacements(outputFolder: string, filename: string) {
    try {
      let fileContent = await readFile(`${outputFolder}/${filename}`, 'utf8')

      for (const [key, value] of this.#replacements) {
        const regex = new RegExp(key, 'g')
        fileContent = fileContent.replace(regex, value)
      }

      await writeFile(`${outputFolder}/${filename}`, fileContent, 'utf8')
    } catch (error) {
      logger.error(`[error]: Failed to apply replacements. Error: ${error.message}`)
    }
  }

  async #translateTranscription([path, { filename }]: [string, TranscoderQueueFile], outputFolder: string) {
    if (!this.#includeTranscription) return

    const languageCodes = ['es', 'fr', 'de', 'pl', 'pt-BR']

    logger.step({ index: 5, process: `Translating transcription`, file: path })
    logger.progress({ file: path, percent: 0 })

    const promises = languageCodes.map((code) => {
      logger.info(`[started]: translation to ${code} for ${filename}`)

      return new Promise((resolve) => {
        exec(`trans :${code} -b -i "${outputFolder}/en.srt" -o "${outputFolder}/${code}.srt"`, (error) => {
          if (error) {
            logger.error(`[translation error]: ${code}: ${error.message}`)
            resolve(null)
            return
          }

          logger.info(`[completed]: translation to ${code} for ${filename}`)

          resolve(`${outputFolder}/${code}.srt`)
        })
      })
    })

    await Promise.all(promises)
    
    logger.progress({ file: path, percent: 100 })
  }

  // #endregion

  // #endregion

  // #region Helpers

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

    logger.info(`[started]: generating main playlist ${outputFolder}/main.m3u8`);

    const main = ['#EXTM3U', '#EXT-X-VERSION:3']

    for (const playlist of playlists) {
      logger.debug(`[playlist]: ${playlist.resolution.height}p for ${playlist.playlistPathFromMain}`)
      main.push(`#EXT-X-STREAM-INF:BANDWIDTH=${playlist.bitrate * 1000},RESOLUTION=${playlist.resolution.width}x${playlist.resolution.height}`);
      main.push(playlist.playlistPathFromMain);
    }

    const final = main.join('\n')

    await writeFile(`${outputFolder}/main.m3u8`, final)

    logger.success(`[completed]: generating main playlist ${outputFolder}/main.m3u8`)

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

  #getOutputFolder(info: TranscoderQueueFile) {
    const filenameLessExt = info.filename.split('.').shift() as string
    const filenamePrefix = filenameLessExt.split(this.#prefixSeparator).shift() as string

    if (!this.#useCuid) {
      return `${this.#output}/${filenameLessExt}`
    }

    if (!this.#prefixSeparator) {
      return `${this.#output}/${cuid()}`
    }

    return `${this.#output}/${filenamePrefix}${this.#prefixSeparator}${cuid()}`
  }

  // #endregion
}
