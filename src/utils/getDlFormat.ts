import type { DownloadFormat } from '../types.ts';

export const getDlFormat = (formats: DownloadFormat[], formatArg: string) => {
  const dlFormat =
    formatArg === 'best'
      ? formats[0]
      : formats.find(
          (f) => f.format_id.toLowerCase() === formatArg.toLowerCase(),
        );
  if (!dlFormat) throw new Error('Wrong format');
  return dlFormat;
};
