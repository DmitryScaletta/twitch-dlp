# twitch-dl

Simple script for downloading twitch VODs from start during live broadcast.

## Features

- Similar to `yt-dlp` (`youtube-dl`) syntax
- Download live VODs from start (like `--live-from-start` in `yt-dlp`)
- Supports VOD links and channel links
- Zero dependencies

## Usage

Install [Node.js](https://nodejs.org/) v20 or newer.

```bash
# npm
npx twitch-dl LINK

# pnpm
pnpm dlx twitch-dl LINK

# yarn v2+
yarn dlx twitch-dl LINK
```

### Examples

```bash
# Download live stream from start using channel link
npx twitch-dl https://www.twitch.tv/xqc

# Download VOD. If it's live, wait until stream ends
npx twitch-dl https://www.twitch.tv/videos/2022789761

# Check available formats
npx twitch-dl https://www.twitch.tv/videos/2022789761 -F

# Download specified format
npx twitch-dl https://www.twitch.tv/videos/2022789761 -f 480p30

# Change output template
npx twitch-dl https://www.twitch.tv/videos/2022789761 -o "%(title)s [%(id)s].%(ext)s"

# Limit download rate
npx twitch-dl https://www.twitch.tv/videos/2022789761 -r 720k
```

## Options

```text
-h, --help                  Show this help message and exit
-f, --format FORMAT         Select format to download.
                            Available formats:
                            - best: best quality
                            - Audio_Only: audio only
                            - FORMAT: select format by format_id
-F, --list-formats          List available formats and exit
-o, --output OUTPUT         Output filename template
                            Available template variables:
                            - %(title)s
                            - %(id)s
                            - %(ext)s
                            - %(description)s
                            - %(duration)s
                            - %(uploader)s
                            - %(uploader_id)s
                            - %(upload_date)s
                            - %(release_date)s
                            - %(view_count)s
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading
```

## Formats example

```bash
┌─────────┬──────────────┬────────┬────────┐
│ (index) │ format_id    │ width  │ height │
├─────────┼──────────────┼────────┼────────┤
│ 0       │ 'Source'     │ '1920' │ '1080' │
│ 1       │ '720p60'     │ '1280' │ '720'  │
│ 2       │ '720p30'     │ '1280' │ '720'  │
│ 3       │ '480p30'     │ '852'  │ '480'  │
│ 4       │ '360p30'     │ '640'  │ '360'  │
│ 5       │ '160p30'     │ '284'  │ '160'  │
│ 6       │ 'Audio_Only' │ null   │ null   │
└─────────┴──────────────┴────────┴────────┘
```

## Requires

- ffmpeg
- curl (if using `--limit-rate` option)
