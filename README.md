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

**This application was built specifically for the Adocasts workflow.**

MacOS command line application that transcodes a queue of video files from a source location to an output location. Each file will be converted into an HLS streamable playlist consisting of video segments for the desired resolutions.

For the output destination selected, when the `USE_UNIQUE_NAME` option is false each video's transcoded playlist will be placed inside a folder named after the file. When true, each video will be placed inside a folder named with a unique id. For each playlist, the resolution segments will be placed in a subfolder named for the resolution.

For example, if the video is called `adonisjs-quick-tip.mp4` and the resolutions 2160p and 1080p are selected, the output will look as such:

```
.
└── [selected destination]/
    └── adonisjs-quick-tip/
        ├── {resolution}p/
        │   ├── adonisjs-quick-tip_{resolution}_001.ts
        │   ├── adonisjs-quick-tip_{resolution}_002.ts
        │   ├── adonisjs-quick-tip_{resolution}_003.ts
        │   └── adonisjs-quick-tip_{resolution}.m3u8
        ├── en.srt [english srt transcription]
        ├── en.txt [english plaintext transcription]
        ├── {code}.srt [srt translations as defined within the env]
        ├── video.mp4 [compressed original]
        ├── video.webp [6s animated webp]
        └── master.m3u8
```

### Features

- Transcribes batch of videos into HLS parts
- Compresses source file to MP4
- Generates a 6s animated WEBP
- Transcribes to `en.srt` and `en.txt` files
- Translates SRT to desired languages ([supported codes](https://www.argosopentech.com/argospm/index/))

### Requirements

The following dependencies need to be installed and accessible via their CLI commands on your system for this application to work. These are not bundled as part of this application.

- [ ] [Ffmpeg](https://ffmpeg.org/) - Used to transcode and compress videos
- [ ] [Faster Whisper (Python)](https://github.com/SYSTRAN/faster-whisper) - Used to generate a transcription of videos
- [ ] [Argos Translate (Python)](https://github.com/argosopentech/argos-translate) - Used to translate the video transcriptions

### Todos

- [x] Include compressed video file (for downloading)
- [x] Generate 6s animated webp image
- [x] Killing NodeJS spawn (cancelling) doesn't cascade through to ffmpeg
- [x] Generate transcription from video
- [x] Translate video transcription to Spanish and French
- [ ] Upload generated files to Cloudflare R2 (not doing for now, prefer to review before uploading)
