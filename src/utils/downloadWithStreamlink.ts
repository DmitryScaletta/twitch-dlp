import * as api from '../api/twitch.ts';
import { isInstalled } from '../lib/isInstalled.ts';
import { spawn } from '../lib/spawn.ts';
import type { AppArgs } from '../types.ts';
import { getPath } from './getPath.ts';
import { getVideoInfoByStreamMeta } from './getVideoInfo.ts';

const DEFAULT_STREAMLINK_ARGS = [
  '--twitch-force-client-integrity',
  '--twitch-access-token-param=playerType=frontpage',
] as const;

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
  if (!(await isInstalled('streamlink'))) {
    throw new Error(
      'streamlink is not installed. Install it from https://streamlink.github.io/',
    );
  }

  if (args['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputPath = getPath.output(
    args.output || getDefaultOutputTemplate(),
    getVideoInfoByStreamMeta(streamMeta, channelLogin),
  );

  const streamlinkArgs = [];
  for (const argName of Object.keys(args)) {
    if (!argName.startsWith('twitch-')) continue;
    type ArgValue = undefined | string | string[] | boolean;
    const argValue = (args as any)[argName] as ArgValue;
    if (argValue === undefined) continue;
    if (Array.isArray(argValue)) {
      for (const v of argValue) {
        streamlinkArgs.push(`--${argName}=${v}`);
      }
    } else {
      streamlinkArgs.push(
        typeof argValue === 'boolean'
          ? `--${argName}`
          : `--${argName}=${argValue}`,
      );
    }
  }

  return spawn('streamlink', [
    '-o',
    outputPath,
    link,
    args.format,
    ...(streamlinkArgs.length ? streamlinkArgs : DEFAULT_STREAMLINK_ARGS),
  ]);
};
