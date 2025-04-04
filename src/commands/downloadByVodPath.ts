import type { AppArgs } from '../main.ts';
import { downloadVideo } from '../utils/downloadVideo.ts';
import {
  getFullVodPath,
  getVideoFormatsByFullVodPath,
} from '../utils/getVideoFormats.ts';
import { getVideoInfoByVodPath } from '../utils/getVideoInfo.ts';
import type { ParsedLinkVodPath } from '../utils/parseLink.ts';

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
