export const allowedExtensions = ["mp4", "mkv", "webm", "mov"];

export enum Resolutions {
  'P2160' = 2160,
  'P1440' = 1440,
  'P1080' = 1080,
  'P720' = 720,
  'P480' = 480
}

export const resolutions = new Map([
  [Resolutions.P2160, { height: 2160, width: 3840, bitrate: 15_000 }],
  [Resolutions.P1440, { height: 1440, width: 2560, bitrate: 10_000 }],
  [Resolutions.P1080, { height: 1080, width: 1920, bitrate: 7_500 }],
  [Resolutions.P720, { height: 720, width: 1280, bitrate: 5_000 }],
  [Resolutions.P480, { height: 480, width: 854, bitrate: 2_500 }]
])