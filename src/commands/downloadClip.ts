import { getClipMetadata, type ClipMetadata } from '../api/twitch.ts';
import { DEFAULT_OUTPUT_TEMPLATE } from '../constants.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import type { AppArgs, DownloadFormat } from '../types.ts';
import { downloadFrag } from '../utils/downloadFrag.ts';
import { getDlFormat } from '../utils/getDlFormat.ts';
import { getPath } from '../utils/getPath.ts';
import { getVideoInfoByClipMeta } from '../utils/getVideoInfo.ts';
import { showFormats } from '../utils/showFormats.ts';

type VideoQuality = ClipMetadata['assets'][number]['videoQualities'][number];

const getClipFormats = (clipMeta: ClipMetadata) => {
  const formats: DownloadFormat[] = [];
  const { signature: sig, value: token } = clipMeta.playbackAccessToken;

  const addFormats = (videoQualities: VideoQuality[], formatIdPrefix = '') => {
    for (let i = 0; i < videoQualities.length; i += 1) {
      const { quality, frameRate, sourceURL } = videoQualities[i];
      if (!sourceURL) continue;
      const url = `${sourceURL}?sig=${sig}&token=${token}`;
      formats.push({
        format_id: `${formatIdPrefix}${quality}`,
        height: Number.parseInt(quality) || null,
        frameRate: frameRate ? Math.round(frameRate) : null,
        source: null,
        url,
      });
    }
  };

  const [assetDefault, assetPortrait] = clipMeta.assets;
  addFormats(assetDefault?.videoQualities || []);
  addFormats(assetPortrait?.videoQualities || [], 'portrait-');
  formats[0].source = true;

  return formats;
};

export const downloadClip = async (slug: string, args: AppArgs) => {
  const clipMeta = await getClipMetadata(slug);
  if (!clipMeta) throw new Error('Clip not found');

  const formats = getClipFormats(clipMeta);

  if (args['list-formats']) return showFormats(formats);

  const dlFormat = getDlFormat(formats, args.format);
  const destPath = getPath.output(
    args.output || DEFAULT_OUTPUT_TEMPLATE,
    getVideoInfoByClipMeta(clipMeta),
  );
  console.log(`[download] Destination: ${destPath}`);

  if (await statsOrNull(destPath)) {
    console.warn(`[download] File already exists, skipping`);
    return;
  }

  const res = await fetch(dlFormat.url, { method: 'HEAD' });
  const size = Number.parseInt(res.headers.get('content-length') || '0');
  console.log(
    `[download] Downloading clip (${(size / 1024 / 1024).toFixed(2)} MB)`,
  );

  const result = await downloadFrag(
    args.downloader,
    dlFormat.url,
    destPath,
    args['limit-rate'],
  );

  if (!result) throw new Error('[download] Download failed');

  console.log('[download] Done');
};
