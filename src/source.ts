import env from '#start/env'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

export default class Source {
  static #extensions = new Set(['mp4', 'mkv', 'mov', 'webm', 'avi'])

  static async getList(sources: string[] | undefined) {
    const filepaths = sources || (await this.#readDefaultSourceFolder())
    return this.#getValidExtensions(filepaths)
  }

  static async #readDefaultSourceFolder() {
    const sourceLocation = env.get('SOURCE_LOCATION')
    const entries = await readdir(sourceLocation, { withFileTypes: true })
    const filenames = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        return [sourceLocation, entry.name].join('/')
      })

    return filenames
  }

  static #getValidExtensions(sources: string[]) {
    return sources.filter((filepath) => {
      const ext = path.extname(filepath)
      const lowerExt = ext.toLowerCase()

      return this.#extensions.has(lowerExt)
    })
  }
}
