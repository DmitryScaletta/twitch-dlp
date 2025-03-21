export const HELP = `
Download any twitch VODs from start during live broadcast

GitHub Repo: https://github.com/DmitryScaletta/twitch-dlp

Usage:
npx twitch-dlp LINK

Positional arguments:
LINK                        Link to the VOD or channel

Options:
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

Requires:
- ffmpeg
- curl (if using --limit-rate option)
- streamlink (if downloading by channel link without --live-from-start)
`;
export const PRIVATE_VIDEO_INSTRUCTIONS =
  'This video might be private. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md';
export const VOD_DOMAINS = [
  'https://d2e2de1etea730.cloudfront.net',
  'https://dqrpb9wgowsf5.cloudfront.net',
  'https://ds0h3roq6wcgc.cloudfront.net',
  'https://d2nvs31859zcd8.cloudfront.net',
  'https://d2aba1wr3818hz.cloudfront.net',
  'https://d3c27h4odz752x.cloudfront.net',
  'https://dgeft87wbj63p.cloudfront.net',
  'https://d1m7jfoe9zdc1j.cloudfront.net',
  'https://d3vd9lfkzbru3h.cloudfront.net',
  'https://d2vjef5jvl6bfs.cloudfront.net',
  'https://d1ymi26ma8va5x.cloudfront.net',
  'https://d1mhjrowxxagfy.cloudfront.net',
  'https://ddacn6pr5v0tl.cloudfront.net',
  'https://d3aqoihi2n8ty8.cloudfront.net',
];
