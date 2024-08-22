# twitch-dlp

Download regular/sub-only/hidden twitch VODs from start during live broadcast

## Features

- Download live VODs from start (`--live-from-start`)
- Download ongoing sub-only/hidden VODs (or if they were hidden during the broadcast)
- Download finished sub-only/hidden VODs (see the [instructions](https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md))
- Download specific part of the video (`--download-sections`)
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

# Download sub-only or hidden VOD
# Follow this instructions first:
# https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md
npx twitch-dlp video:xqc_51582913581_1721686515

# Check every 60 seconds is channel live
# If it's live, start to download it using streamlink
npx twitch-dlp https://www.twitch.tv/xqc --retry-streams 60

# Check every 60 seconds is channel live
# If it's live, start to download it's VOD from start
npx twitch-dlp https://www.twitch.tv/xqc --retry-streams 60 --live-from-start

# Download 10 minutes in the middle of the VOD
npx twitch-dlp https://www.twitch.tv/videos/2022789761 --download-sections "*15:00-25:00"

# Display available formats
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -F

# Download specified format
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -f 480p30

# Change output template
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -o "%(title)s [%(id)s].%(ext)s"

# Limit download rate
npx twitch-dlp https://www.twitch.tv/videos/2022789761 -r 720k

# Merge already downloaded fragments (if something went wrong)
# Filename must match the fragment names but without ".part-FragN"
# Use `--download-sections` if you want to merge only specific part of the video
npx twitch-dlp "./Chillin [v2222470239].mp4" --merge-fragments
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
                            between each attempt
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading
--download-sections TEXT    Download specific part of the video.
                            Syntax: "*start_time-end_time".
                            Examples: "*0-12:34", "*3:14:15-inf"
                            A "*" prefix is for yt-dlp compatibility.
                            Negative timestamps and multiple
                            sections are not supported
--merge-fragments           Merge already downloaded fragments.
                            Example: "npx twitch-dlp FILENAME
                            --merge-fragments". FILENAME must match
                            the fragment names but without
                            ".part-FragN". Can't be used with other
                            options (except --download-sections)
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
