import env from '#start/env'
import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Runner from '../src/runner.js'
import Source from '../src/source.js'

export default class RunTranscoder extends BaseCommand {
  static commandName = 'run:transcoder'
  static description = 'Run the transcoder & transcription on the listed files'
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

  @flags.boolean({
    description: 'Include video transcription with the output',
    default: env.get('INCLUDE_TRANSCRIPTION', true),
    alias: 't',
  })
  declare transcribe: boolean

  @flags.boolean({
    flagName: 'mp4',
    description: 'Include compressed MP4',
    default: env.get('INCLUDE_MP4', true),
  })
  declare includeMp4: boolean

  @flags.boolean({
    flagName: 'webp',
    description: 'Include animated WEBP image',
    default: env.get('INCLUDE_WEBP', true),
  })
  declare includeWebp: boolean

  @args.spread({
    required: false,
  })
  declare sources: string[] | undefined

  async run() {
    const sources = await Source.getList(this.sources)
    const runner = new Runner(sources, {
      output: this.output,
      useUniqueName: this.useUniqueName,
      transcode: true,
      transcribe: this.transcribe,
      includeMp4: this.includeMp4,
      includeWebp: this.includeWebp,
    })

    await runner.run()
  }
}
