import { replacements } from '#config/replacements'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import Progress from './lib/progress.js'
import QueuedFile from './lib/queued_file.js'

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
      // 👇 location of faster-whisper python isolation `pipx install faster-whisper`
      const command = env.get('PYTHON_FASTER_WHISPER')
      const whisperArgs = [
        './faster_whisper_cli.py',
        `"${this.source}"`,
        `"${this.item.destination}"`,
        'large-v2',
      ]

      const progress = new Progress('Transcribing')

      progress.start()

      const whisperProcess = spawn(command, whisperArgs, { shell: true })

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
        progress.update(100)

        if (code !== 0) {
          logger.error(`[error]: Whisper process exited with code ${code}. Transcription failed.`)
          resolve(null)
          return
        }

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
    await this.#transcribeApplyReplacements('en.srt')
    await this.#transcribeApplyReplacements(`en.txt`)

    logger.info(`[completed]: post-processing and clean up`)

    return `${this.item.destination}/en.srt`
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
