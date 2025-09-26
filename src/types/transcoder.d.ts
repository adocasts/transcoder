import QueuedFile from '../queued_file.ts'

export interface RunnerOptions {
  output: string
  useUniqueName: boolean
  transcode: boolean
  transcribe: boolean
  includeMp4: boolean
  includeWebp: boolean
}

export type QueueMap = Map<string, QueuedFile>

export type TranscoderPlaylist = {
  resolution: { width: number; height: number }
  bitrate: number
  playlistFilename: string
  playlistPathFromMain: string
  playlistPath: string
}
