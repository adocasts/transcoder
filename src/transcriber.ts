''''''''''import { replacements } from '#config/replacements'
import logger from "@adonisjs/core/services/logger"
import { exec, spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import Progress from "./lib/progress.js"
import QueuedFile from "./lib/queued_file.js"

export default class Transcriber {
  declare source: string
  declare item: QueuedFile

  success = false

  constructor(source: string, item: QueuedFile) {
    this.source = source
    this.item = item
  }

  async run() {
    logger.info('Transcribing audio ...')
    return this.#transcribe()
  }

  async #transcribe(): Promise<string | null> {
    return new Promise((resolve) => {
      const whisperArgs = [
        `"${this.source}"`,
        '--output_dir',
        `"${this.item.destination}"`,
        '--output_format',
        'all',
        '--model',
        'large-v2',
        '--language',
        'en',
        '--verbose',
        'False',
      ]

      const progress = new Progress('Transcribing')

      progress.start()

      // execute the command using `spawn`
      const whisperProcess = spawn('whisper', whisperArgs, { shell: true })

      // capture stdout data in real-time
      whisperProcess.stdout.on('data', (data) => {
        logger.debug('[stdout] ' + data.toString())
      })

      // capture stderr data in real-time
      whisperProcess.stderr.on('data', (data) => {
        if (data.includes('%')) {
          const percent = Number(data.toString().split('|').at(0).replace('%', '').trim())
          progress.update(percent)
        }
        logger.debug(data.toString())
      })

      // `spawn` emits a 'close' event when the process finishes
      whisperProcess.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`[error]: Whisper process exited with code ${code}. Transcription failed.`)
          resolve(null)
          return
        }

        logger.info(`[completed]: transcribing ${this.source}; post-processing...`)

        const srtFinal = await this.#transcribeCleanUp()

        progress.update(100)

        resolve(srtFinal)
      })

      // handle errors if the command itself cannot be executed
      whisperProcess.on('error', (err) => {
        logger.error(`[error]: Failed to start the whisper process. Error: ${err.message}`)
        resolve(null)
      })
    })
  }

  async #transcribeCleanUp(): Promise<string | null> {
    const source = this.source.split('.')[0]
    const sourceName = source.split('/').pop()

    const renameAndCleanUpCommand = `
      mv "${source}.srt" "${this.item.destination}/en.srt" &&
      rm "${this.item.destination}"/*.{vtt,tsv,json}
    `

    return new Promise((resolve) => {
      // execute the post-processing command after the main process finishes
      exec(renameAndCleanUpCommand, async (error) => {
        if (error) {
          logger.error(`[post-processing error]: ${error.message}`)
          resolve(null)
          return
        }

        await this.#transcribeApplyReplacements('en.srt')
        await this.#transcribeApplyReplacements(`${sourceName}.txt`)

        logger.info(`[completed]: post-processing and clean up`)

        resolve(`${this.item.destination}/en.srt`)
      })
    })
  }

  async #transcribeApplyReplacements(filename: string) {
    try {
      let fileContent = await readFile(`${this.item.destination}/${filename}`, 'utf8')

      for (const [key, value] of replacements) {
        const regex = new RegExp(key, 'g')
        fileContent = fileContent.replace(regex, value)
      }

      await writeFile(`${this.item.destination}/${filename}`, fileContent, 'utf8')
    } catch (error) {
      logger.error(`[error]: Failed to apply replacements. Error: ${error.message}`)
    }
  }
}
