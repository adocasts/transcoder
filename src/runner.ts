import { InvalidArgumentsException } from '@adonisjs/core/exceptions'
import { mkdir } from 'node:fs/promises'
import QueuedFile from './lib/queued_file.js'
import Transcoder from './transcoder.js'
import { QueueMap, RunnerOptions } from './types/transcoder.js'

export default class Runner {
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
    }
  }

  async #transcode(source: string, item: QueuedFile) {
    const transcoder = new Transcoder(source, item)
    await transcoder.run()
  }
}
