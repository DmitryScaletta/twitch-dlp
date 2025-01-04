import * as api from '../api/twitch.ts';
import { spawn } from '../lib/spawn.ts';
import { getPath } from './getPath.ts';
import type { AppArgs } from '../main.ts';
import type { VideoInfo } from '../types.ts';

export const getStreamInfo = (
  channel: api.StreamMetadataResponse,
  channelLogin: string,
): VideoInfo => ({
  id: channel.stream!.id,
  title: channel.lastBroadcast.title || 'Untitled Broadcast',
  uploader: channelLogin,
  uploader_id: channel.id,
  upload_date: channel.stream!.createdAt,
  release_date: channel.stream!.createdAt,
  ext: 'mp4',
});

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
  channel: api.StreamMetadataResponse,
  channelLogin: string,
  args: AppArgs,
) => {
  if (args.values['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputPath = getPath.output(
    args.values.output || getDefaultOutputTemplate(),
    getStreamInfo(channel, channelLogin),
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
