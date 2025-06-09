import type { DownloadFormat } from '../types.ts';

export const showFormats = (formats: DownloadFormat[]) => {
  console.table(
    [...formats]
      .reverse()
      .map(({ format_id, width, height, frameRate, totalBitrate, source }) => {
        const fmt: Record<string, any> = {};
        fmt.format_id = format_id;
        fmt.resolution = 'unknown';
        if (format_id === 'Audio_Only') {
          fmt.resolution = 'audio only';
        } else if (width && height) {
          fmt.resolution = `${width}x${height}`;
        } else if (height) {
          fmt.resolution = `${height}p`;
        }
        fmt.fps = frameRate;
        if (totalBitrate) {
          fmt.total_bitrate = `${(totalBitrate / 1024).toFixed()}k`;
        }
        fmt.source = source;
        return fmt;
      }),
  );
};
