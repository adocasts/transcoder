import env from '#start/env'
import { InvalidArgumentsException } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { mkdir } from 'node:fs/promises'
import Compressor from './compressor.js'
import GenerateAudio from './generate_audio.js'
import GenerateWebp from './generate_webp.js'
import QueuedFile from './lib/queued_file.js'
import Transcoder from './transcoder.js'
import Transcriber from './transcriber.js'
import Translator from './translator.js'
import { QueueMap, RunnerOptions } from './types/transcoder.js'

type ResultKeys = 'compressed' | 'webp' | 'audio' | 'transcription'

export default class Runner {
  #resolutions = env.get('RESOLUTIONS').split(',')
  #queue: QueueMap = new Map()
  #options: RunnerOptions

  results: Map<ResultKeys, string | null | undefined> = new Map()

  constructor(sources: string[], options: RunnerOptions) {
    this.#queue = QueuedFile.create(sources, options)
    this.#options = options

    if (!this.#options.output) {
      throw new InvalidArgumentsException('An output destination has not been specified')
    }
  }

  async run() {
    for (const [source, item] of this.#queue) {
      logger.info(`Creating destination directory: ${item.destination}`)

      // create destination folder path
      await mkdir(item.destination, { recursive: true })

      await this.#transcode(source, item)
      await this.#compress(source, item)
      await this.#webp(source, item)
      await this.#transcribe(source, item)
    }
  }

  async #transcode(source: string, item: QueuedFile) {
    if (!this.#options.transcode) return
    if (!this.#resolutions.length) return

    const transcoder = new Transcoder(source, item)
    await transcoder.run()
  }

  async #compress(source: string, item: QueuedFile) {
    if (!this.#options.includeMp4) return

    const compressor = new Compressor(source, item)
    const compressed = await compressor.run()

    this.results.set('compressed', compressed)

    return compressed
  }

  async #webp(source: string, item: QueuedFile) {
    if (!this.#options.includeWebp) return

    const generator = new GenerateWebp(source, item)
    const webp = await generator.run()

    this.results.set('webp', webp)

    return webp
  }

  async #transcribe(source: string, item: QueuedFile) {
    if (!this.#options.transcribe) return

    const audioGenerator = this.#getAudioGenerator(source, item)
    const audio = await audioGenerator.run()

    this.results.set('audio', audio)

    if (!audio) {
      logger.error('Skipping transcription, no audio file was generated')
      return
    }

    const transcriber = new Transcriber(audio, item)
    const transcription = await transcriber.run()

    this.results.set('transcription', transcription)

    if (!transcription) {
      logger.error('Skipping translations, no transcription file was generated')
      await audioGenerator.destroy()
      return
    }

    const translator = new Translator(transcription, item)
    await translator.run()

    await audioGenerator.destroy()
  }

  #getAudioGenerator(source: string, item: QueuedFile) {
    const path = this.results.get('compressed') ?? source
    return new GenerateAudio(path, item)
  }
}
