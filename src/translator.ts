import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { exec } from 'node:child_process'
import QueuedFile from './lib/queued_file.js'

export default class Translator {
  #codes = env.get('TRANSCRIPTION_LANGS')?.split(',') ?? []

  declare source: string
  declare item: QueuedFile

  success = false

  constructor(source: string, item: QueuedFile) {
    this.source = source
    this.item = item
  }

  async run() {
    logger.info('Translating audio ...')

    for (const code of this.#codes) {
      await this.#translate(code)
    }
  }

  async #translate(code: string): Promise<string | null> {
    const dest = [this.item.destination, `${code}.srt`].join('/')

    return new Promise((resolve) => {
      exec(`trans :${code} -b -i "${this.source}" -o "${dest}"`, (error) => {
        if (error) {
          logger.error(`[translation error]: ${code}: ${error.message}`)
          resolve(null)
          return
        }

        logger.info(`[completed]: translation to ${code} for ${this.source}`)

        resolve(dest)
      })
    })
  }
}
