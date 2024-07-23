# twitch-dlp

Simple script for downloading twitch VODs from start during live broadcast.

## Features

- Download live VODs from start (`--live-from-start`)
- Download private VODs (or if they were hidden during the broadcast)
- Download sub-only VODs (ongoing streams)
- For finished sub-only streams see the [instructions](https://github.com/DmitryScaletta/twitch-dlp/blob/master/SUB_ONLY_VIDEOS.md)
- Watch channel status. If it becomes live, start downloading (`--retry-streams DELAY`)
- Supports VOD links and channel links
- Similar to `yt-dlp` (`youtube-dl`) syntax

## Usage

Install [Node.js](https://nodejs.org/) v20 or newer.

```bash
# npm
npx twitch-dlp LINK

# pnpm
pnpm dlx twitch-dlp LINK

# yarn v2+
yarn dlx twitch-dlp LINK
```

### Examples

```bash
# Download a VOD from start using channel link, continue until stream ends
npx twitch-dlp https://www.twitch.tv/xqc --live-from-start

# Download a VOD. If it's live, continue until stream ends
npx twitch-dlp https://www.twitch.tv/videos/2022789761

# Download live stream from the current time using streamlink
npx twitch-dlp https://www.twitch.tv/xqc

# Check every 60 seconds is channel live
# If it's live, start to download it using streamlink
npx twitch-dlp https://www.twitch.tv/xqc --retry-streams 60

# Check every 60 seconds is channel live
# If it's live, start to download it's VOD from start
npx twitch-dlp https://www.twitch.tv/xqc --retry-streams 60 --live-from-start

# Display available formats
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -F

# Download specified format
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -f 480p30

# Change output template
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -o "%(title)s [%(id)s].%(ext)s"

# Limit download rate
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -r 720k
```

## Options

```text
-h, --help                  Show this help message and exit
-f, --format FORMAT         Select format to download
                            Available formats:
                            - best: best quality (default)
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
--live-from-start           Download live streams from the start
--retry-streams DELAY       Retry fetching the list of available
                            streams until streams are found
                            while waiting DELAY second(s)
                            between each attempt.
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading
```

## Formats example

For VODs

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

For live streams (streamlink)

```bash
Available streams: audio_only, 160p (worst), 360p, 480p, 720p, 720p60, 1080p60 (best)
```

```bash
Available streams: audio_only, 160p (worst), 360p, 480p, 720p, 720p60_alt, 720p60 (best)
```

## Requires

- **ffmpeg**
- **curl** (if using `--limit-rate` option)
- **streamlink** (if downloading by channel link without `--live-from-start`)
