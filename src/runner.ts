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

export default class Runner {
  #resolutions = env.get('RESOLUTIONS').split(',')
  #queue: QueueMap = new Map()
  #options: RunnerOptions

  declare compressed: string | null | undefined
  declare webp: string | null | undefined
  declare audio: string | null | undefined
  declare transcription: string | null | undefined

  constructor(sources: string[], options: RunnerOptions) {
    this.#queue = QueuedFile.create(sources, options)
    this.#options = options

    if (!this.#options.output) {
      throw new InvalidArgumentsException('An output destination has not been specified')
    }
  }

  async run() {
    for (const [source, item] of this.#queue) {
      // create destination folder path
      await mkdir(item.destination, { recursive: true })

      await this.#transcode(source, item)
      this.compressed = await this.#compress(source, item)
      this.webp = await this.#webp(source, item)

      await this.#transcribe(source, item)
    }
  }

  async #transcode(source: string, item: QueuedFile) {
    if (!this.#resolutions.length) return

    const transcoder = new Transcoder(source, item)
    await transcoder.run()
  }

  async #compress(source: string, item: QueuedFile) {
    if (!this.#options.includeMp4) return

    const compressor = new Compressor(source, item)
    return compressor.run()
  }

  async #webp(source: string, item: QueuedFile) {
    if (!this.#options.includeWebp) return

    const generator = new GenerateWebp(source, item)
    return generator.run()
  }

  async #transcribe(source: string, item: QueuedFile) {
    if (!this.#options.transcribe) return

    const audioGenerator = this.#getAudioGenerator(source, item)
    this.audio = await audioGenerator.run()

    if (!this.audio) {
      logger.error('Skipping transcription, no audio file was generated')
      return
    }

    const transcriber = new Transcriber(this.audio, item)
    this.transcription = await transcriber.run()

    if (!this.transcription) {
      logger.error('Skipping translations, no transcription file was generated')
      await audioGenerator.destroy()
      return
    }

    const translator = new Translator(this.transcription, item)
    await translator.run()

    await audioGenerator.destroy()
  }

  #getAudioGenerator(source: string, item: QueuedFile) {
    const path = this.compressed ?? source
    return new GenerateAudio(path, item)
  }
}
