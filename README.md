![Adocasts](https://github.com/adocasts/.github/blob/main/assets/brand-banner-rounded.png?raw=true)

Adocasts provides education lessons, screencasts, and livestreams on AdonisJS, NodeJS, JavaScript, and more. We have a vast library of free lessons and resources that expands weekly to help get you up and running with AdonisJS.

Get even more by joining [Adocasts Plus](https://adocasts.com/pricing)

📚 Ready to learn? [Check out adocasts.com](https://adocasts.com)  
🎉 New lessons every week!

---

[![YouTube Badge](https://img.shields.io/youtube/channel/subscribers/UCTEKX3KQAJi7_0-_rSz0Edg?logo=YouTube&style=for-the-badge)](https://youtube.com/adocasts)
[![Twitter Badge](https://img.shields.io/twitter/follow/adocasts?logo=twitter&logoColor=white&style=for-the-badge)](https://twitter.com/adocasts)
[![Twitch Badge](https://img.shields.io/twitch/status/adocasts?logo=twitch&logoColor=white&style=for-the-badge)](https://twitch.tv/adocasts)

---

![Adocasts Transcoder](https://raw.githubusercontent.com/adocasts/transcoder/refs/heads/main/src/assets/screenshot.png)

MacOS desktop application that transcodes a queue of video files into an HLS streamable playlist consisting of video segments for the desired resolutions.

For the output destination selected, when the output id option is deselected each video's transcoded playlist will be placed inside a folder named after the file. When the output id option is selected, each video will be placed inside a folder named with a unique id. For each playlist, the resolution segments will be placed in a subfolder named for the resolution.

For example, if the video is called `adonisjs-quick-tip.mp4` and the resolutions 2160p and 1080p are selected, the output will look as such:

```
.
└── [selected destination]/
    └── adonisjs-quick-tip/
        ├── 1080p/
        │   ├── adonisjs-quick-tip_1080_001.ts
        │   ├── adonisjs-quick-tip_1080_002.ts
        │   ├── adonisjs-quick-tip_1080_003.ts
        │   └── adonisjs-quick-tip_1080.m3u8
        ├── 2160p/
        │   ├── adonisjs-quick-tip_2160_001.ts
        │   ├── adonisjs-quick-tip_2160_002.ts
        │   ├── adonisjs-quick-tip_2160_003.ts
        │   └── adonisjs-quick-tip_2160.m3u8
        ├── video.mp4 [compressed original]
        ├── video.webp [6s animated webp]
        └── master.m3u8
```

### Goals

This application was specifically built for usage with the Adocasts stack and has only been tested on a MacOS system.
Additional requirements, listed below, need to be installed on your system in order for this application to run successfully.

### Requirements

The following requirements need to be installed on your system for this application to work and is not bundled as part of this application.

- [ ] [Ffmpeg](https://ffmpeg.org/) - Used to transcode and compress videos
  <!-- - [ ] [Whisper](https://github.com/openai/whisper/) - Used to generate a transcription of videos -->
  <!-- - [ ] [Translate Shell](https://github.com/soimort/translate-shell) - Used to translate the video transcriptions -->

### Todos

- [x] Include compressed video file (for downloading)
- [x] Generate 6s animated webp image
- [x] Killing NodeJS spawn (cancelling) doesn't cascade through to ffmpeg
- [ ] Generate transcription from video
- [ ] Translate video transcription to Spanish and French
- [ ] Upload generated files to Cloudflare R2

### Thank Yous

The transcoding process (`sidecar-node-transcoder/src/transcoder`) is based on work done by:

- [Steve Tenuto](https://gist.github.com/stenuto/9ff19ce89f07c7419a8d0976736ebe12)
- [Wes Bos](https://github.com/wesbos/R2-video-streaming/tree/main)
