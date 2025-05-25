import { getClipMetadata, type ClipMetadata } from '../api/twitch.ts';
import { DEFAULT_OUTPUT_TEMPLATE } from '../constants.ts';
import { statsOrNull } from '../lib/statsOrNull.ts';
import type { AppArgs, DownloadFormat } from '../types.ts';
import { downloadFrag } from '../utils/downloadFrag.ts';
import { getPath } from '../utils/getPath.ts';
import { getVideoInfoByClipMeta } from '../utils/getVideoInfo.ts';

type VideoQuality = ClipMetadata['assets'][number]['videoQualities'][number];

const getClipFormats = (clipMeta: ClipMetadata) => {
  const formats: DownloadFormat[] = [];
  const { signature: sig, value: token } = clipMeta.playbackAccessToken;

  const addFormats = (videoQualities: VideoQuality[], formatIdPrefix = '') => {
    for (const { quality, frameRate, sourceURL } of videoQualities) {
      if (!sourceURL) continue;
      const url = `${sourceURL}?sig=${sig}&token=${token}`;
      formats.push({
        format_id: `${formatIdPrefix}${quality}`,
        height: Number.parseInt(quality) || null,
        frameRate: frameRate ? Math.round(frameRate) : null,
        url,
      });
    }
  };

  const [assetDefault, assetPortrait] = clipMeta.assets;
  addFormats(assetDefault?.videoQualities || []);
  addFormats(assetPortrait?.videoQualities || [], 'portrait-');

  return formats;
};

export const downloadClip = async (slug: string, args: AppArgs) => {
  const clipMeta = await getClipMetadata(slug);
  if (!clipMeta) throw new Error('Clip not found');

  const formats = getClipFormats(clipMeta);

  if (args['list-formats']) {
    console.table(formats.map(({ url, ...rest }) => rest));
    return;
  }

  const dlFormat =
    args.format === 'best'
      ? formats[0]
      : formats.find(
          (f) => f.format_id.toLowerCase() === args.format.toLowerCase(),
        );
  if (!dlFormat) throw new Error('Wrong format');

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
