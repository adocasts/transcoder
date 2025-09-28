import env from '#start/env'
import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Runner from '../src/runner.js'
import Source from '../src/source.js'

export default class RunTranscriber extends BaseCommand {
  static commandName = 'run:transcriber'
  static description = 'Run transcriber and translator'
  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Location to place final processed files',
    default: env.get('OUTPUT_LOCATION'),
  })
  declare output: string

  @flags.boolean({
    flagName: 'unique',
    description: 'Split name by `_` and suffix with a CUID',
    alias: 'u',
    default: env.get('USE_UNIQUE_NAME', true),
  })
  declare useUniqueName: boolean

  @args.spread({
    required: false,
  })
  declare sources: string[] | undefined

  async run() {
    const sources = await Source.getList(this.sources)
    this.logger.log(`found ${sources.length} sources`)
    const runner = new Runner(sources, {
      output: this.output,
      useUniqueName: this.useUniqueName,
      transcode: false,
      transcribe: true,
      includeMp4: false,
      includeWebp: false,
    })

    await runner.run()
  }
}
