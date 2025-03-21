import * as api from '../api/twitch.ts';
import { spawn } from '../lib/spawn.ts';
import { getPath } from './getPath.ts';
import { getVideoInfoByStreamMeta } from './getVideoInfo.ts';
import type { AppArgs } from '../main.ts';

const getDefaultOutputTemplate = () => {
  const now = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')
    .replace(':', '_');
  return `%(uploader)s (live) ${now} [%(id)s].%(ext)s`;
};

export const downloadWithStreamlink = async (
  link: string,
  streamMeta: api.StreamMetadata,
  channelLogin: string,
  args: AppArgs,
) => {
  if (args.values['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputPath = getPath.output(
    args.values.output || getDefaultOutputTemplate(),
    getVideoInfoByStreamMeta(streamMeta, channelLogin),
  );

  const streamlinkArgs = [
    '-o',
    outputPath,
    link,
    args.values.format,
    '--twitch-disable-ads',
  ];
  return spawn('streamlink', streamlinkArgs);
};
