import * as api from '../api/twitch.ts';
import { spawn } from '../lib/spawn.ts';
import { getPath } from './getPath.ts';
import { getVideoInfoByStreamMeta } from './getVideoInfo.ts';
import type { AppArgs } from '../main.ts';

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
  if (args.values['list-formats']) {
    await spawn('streamlink', ['-v', link]);
    process.exit();
  }

  const outputPath = getPath.output(
    args.values.output || getDefaultOutputTemplate(),
    getVideoInfoByStreamMeta(streamMeta, channelLogin),
  );

  const streamlinkArgs = [];
  for (const argName of Object.keys(args.values)) {
    if (!argName.startsWith('twitch-')) continue;
    type ArgValue = undefined | string | string[] | boolean;
    const argValue = (args.values as any)[argName] as ArgValue;
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
    args.values.format,
    ...(streamlinkArgs.length ? streamlinkArgs : DEFAULT_STREAMLINK_ARGS),
  ]);
};
