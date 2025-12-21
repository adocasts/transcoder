import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { exec } from 'node:child_process'
import QueuedFile from './lib/queued_file.js'
import { readFile, writeFile } from 'node:fs/promises'
import subsrt from 'subsrt-ts'
import { ContentCaption } from 'subsrt-ts/dist/types/handler.js'

type Caption = {
  type: string
  index: number
  start: number
  end: number
  duration: number
  content: string
  text: string
}

export default class Translator {
  #codes = env.get('TRANSCRIPTION_LANGS')?.split(',') ?? []

  declare source: string
  declare item: QueuedFile

  newline = '\n'
  success = false

  constructor(source: string, item: QueuedFile) {
    this.source = source
    this.item = item
  }

  async run() {
    logger.info('Translating audio ...')

    const captions = await this.#parseSrt()
    const translatable = this.#toTranslatableString(captions)

    for (const code of this.#codes) {
      const translation = await this.#translate(code, translatable)

      if (!translation) {
        logger.error(`Failed to translate ${code} for: ${this.item.filename}`)
        continue
      }

      const translated = this.#fromTranslatedString(captions, translation)
      await this.#buildSrt(code, translated)
    }
  }

  async #translate(code: string, translatable: string): Promise<string> {
    return new Promise(async (resolve) => {
      exec(
        `argos-translate --from-lang en --to-lang ${code} "${translatable}"`,
        (error, stdout) => {
          if (error) {
            logger.error(`[translation error]: ${code}: ${error.message}`)
            resolve('')
            return
          }

          resolve(stdout)
        }
      )
    })
  }

  async #buildSrt(code: string, captions: ContentCaption[]) {
    const dest = [this.item.destination, `${code}.srt`].join('/')
    const contents = subsrt.build(captions, { format: 'srt' })

    await writeFile(dest, contents)
  }

  async #parseSrt() {
    const contents = await readFile(this.source, 'utf8')
    return subsrt.parse(contents, { format: 'srt' }) as ContentCaption[]
  }

  #toTranslatableString(captions: ContentCaption[]) {
    return captions.map((c) => c.text).join(this.newline)
  }

  #fromTranslatedString(captions: ContentCaption[], translation: string) {
    const translationParts = translation.split(this.newline)

    return captions.map((caption, i) => {
      const result = { ...caption }
      const line = translationParts.at(i)

      if (!line) {
        logger.error(`Translated line match not found, index: ${i}`)
        return result
      }

      result.content = line
      result.text = line

      return result
    })
  }
}
