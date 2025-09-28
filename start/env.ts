/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // transcoder options
  SOURCE_LOCATION: Env.schema.string(),
  OUTPUT_LOCATION: Env.schema.string(),
  PYTHON_FASTER_WHISPER: Env.schema.string(),
  USE_UNIQUE_NAME: Env.schema.boolean(),
  INCLUDE_MP4: Env.schema.boolean(),
  INCLUDE_WEBP: Env.schema.boolean(),
  INCLUDE_TRANSCRIPTION: Env.schema.boolean(),
  TRANSCRIPTION_LANGS: Env.schema.string(),
  RESOLUTIONS: Env.schema.string(),
})
