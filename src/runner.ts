import env from '#start/env'
import { InvalidArgumentsException } from '@adonisjs/core/exceptions'
import { mkdir } from 'node:fs/promises'
import Compressor from './compressor.js'
import GenerateWebp from './generate_webp.js'
import QueuedFile from './lib/queued_file.js'
import Transcoder from './transcoder.js'
import { QueueMap, RunnerOptions } from './types/transcoder.js'

export default class Runner {
  #resolutions = env.get('RESOLUTIONS').split(',')
  #queue: QueueMap = new Map()
  #options: RunnerOptions

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
      await this.#compress(source, item)
      await this.#webp(source, item)
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
    await compressor.run()
  }

  async #webp(source: string, item: QueuedFile) {
    if (!this.#options.includeWebp) return

    const generator = new GenerateWebp(source, item)
    await generator.run()
  }
}
