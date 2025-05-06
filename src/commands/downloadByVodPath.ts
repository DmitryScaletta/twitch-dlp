import type { AppArgs } from '../types.ts';
import type { ParsedLinkVodPath } from '../utils/args/parseLink.ts';
import { downloadVideo } from '../utils/downloadVideo.ts';
import {
  getFullVodPath,
  getVideoFormatsByFullVodPath,
} from '../utils/getVideoFormats.ts';
import { getVideoInfoByVodPath } from '../utils/getVideoInfo.ts';

export const downloadByVodPath = async (
  parsedLink: ParsedLinkVodPath,
  args: AppArgs,
) => {
  const formats = await getVideoFormatsByFullVodPath(
    getFullVodPath(parsedLink.vodPath),
  );
  const videoInfo = getVideoInfoByVodPath(parsedLink);
  return downloadVideo(formats, videoInfo, args);
};
