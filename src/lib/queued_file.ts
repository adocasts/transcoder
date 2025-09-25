import { InvalidArgumentsException } from '@adonisjs/core/exceptions'
import { cuid } from '@adonisjs/core/helpers'
import { RunnerOptions } from '../types/transcoder.js'

export default class QueuedFile {
  #allowedExtensions = new Set(['mp4', 'mkv', 'webm', 'mov'])
  #prefixSeparator = '_'

  declare filename: string
  declare extname: string
  declare destinationPath: string
  declare destinationFolder: string
  declare state: 'queued' | 'running' | 'done' | 'failed'

  get destination() {
    return [this.destinationPath, this.destinationFolder].join('/')
  }

  constructor(file: string, options: RunnerOptions) {
    this.filename = file.split('/').pop()!
    this.extname = file.split('.').pop()!
    this.destinationPath = options.output

    if (!this.#allowedExtensions.has(this.extname)) {
      throw new InvalidArgumentsException(`unsupported file type, file will be skipped: ${file}`)
    }

    const filenameLessExt = this.filename.split('.').shift()!
    const filenamePrefix = filenameLessExt.split(this.#prefixSeparator).shift()!

    this.destinationFolder = options.useUniqueName
      ? `${filenamePrefix}${this.#prefixSeparator}${cuid()}`
      : filenameLessExt
  }

  static create(files: string[], options: RunnerOptions) {
    const queue = new Map<string, QueuedFile>()

    for (const file of files) {
      queue.set(file, new QueuedFile(file, options))
    }

    return queue
  }
}
