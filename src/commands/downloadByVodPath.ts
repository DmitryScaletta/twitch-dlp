import type { AppArgs } from '../types.ts';
import type { ParsedLinkVodPath } from '../utils/args/parseLink.ts';
import { downloadVideo } from '../utils/downloadVideo.ts';
import {
  getFullVodPath,
  getVideoFormatsByFullVodPath,
} from '../utils/getVideoFormats.ts';
import { getVideoInfoByVodPath } from '../utils/getVideoInfo.ts';
import { getWhyCannotDownload } from '../utils/getWhyCannotDownload.ts';

export const downloadByVodPath = async (
  parsedLink: ParsedLinkVodPath,
  args: AppArgs,
) => {
  const formats = await getVideoFormatsByFullVodPath(
    getFullVodPath(parsedLink.vodPath),
  );

  if (formats.length === 0) {
    const reasons = await getWhyCannotDownload();
    throw new Error(`Cannot get video formats\n\n${reasons}`);
  }

  const videoInfo = getVideoInfoByVodPath(parsedLink);
  return downloadVideo(formats, videoInfo, args);
};
