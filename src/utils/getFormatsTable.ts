import type { DownloadFormat } from '../types.ts';

type TableRow = {
  format_id: string;
  resolution: string;
  fps: number | null | undefined;
  total_bitrate?: string;
  source: true | null;
};

const formatToTableRow = ({
  format_id,
  width,
  height,
  frameRate,
  totalBitrate,
  source,
}: DownloadFormat) => {
  const fmt = {} as TableRow;
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
};

export const getFormatsTable = (formats: DownloadFormat[]) =>
  [...formats].reverse().map(formatToTableRow);
