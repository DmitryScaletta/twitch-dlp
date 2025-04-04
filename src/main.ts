#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { downloadByChannelLogin } from './commands/downloadByChannelLogin.ts';
import { downloadByVideoId } from './commands/downloadByVideoId.ts';
import { downloadByVodPath } from './commands/downloadByVodPath.ts';
import { mergeFragments } from './commands/mergeFragments.ts';
import { showHelp } from './commands/showHelp.ts';
import { showVersion } from './commands/showVersion.ts';
import { MERGE_METHODS } from './constants.ts';
import { chalk } from './lib/chalk.ts';
import type { Downloader, MergeMethod } from './types.ts';
import { getDownloader } from './utils/getDownloader.ts';
import { parseDownloadSectionsArg } from './utils/parseDownloadSectionsArg.ts';
import { parseLink } from './utils/parseLink.ts';

const getArgs = () =>
  parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
      },
      format: {
        type: 'string',
        short: 'f',
        default: 'best',
      },
      'list-formats': {
        type: 'boolean',
        short: 'F',
      },
      output: {
        type: 'string',
        short: 'o',
      },
      downloader: {
        type: 'string',
        default: 'fetch',
      },
      'keep-fragments': {
        type: 'boolean',
        default: false,
      },
      'limit-rate': {
        type: 'string',
        short: 'r',
      },
      'live-from-start': {
        type: 'boolean',
      },
      'retry-streams': {
        type: 'string',
      },
      'download-sections': {
        type: 'string',
      },
      unmute: {
        type: 'string',
      },
      'merge-fragments': {
        type: 'boolean',
      },
      'merge-method': {
        type: 'string',
        default: 'ffconcat',
      },
      // streamlink twitch plugin args
      // https://streamlink.github.io/cli.html#twitch
      'twitch-disable-ads': { type: 'boolean' },
      'twitch-low-latency': { type: 'boolean' },
      'twitch-api-header': { type: 'string', multiple: true },
      'twitch-access-token-param': { type: 'string', multiple: true },
      'twitch-force-client-integrity': { type: 'boolean' },
      'twitch-purge-client-integrity': { type: 'boolean' },
    },
    allowPositionals: true,
  });

type RawArgs = ReturnType<typeof getArgs>;

export type AppArgs = Omit<
  RawArgs['values'],
  'download-sections' | 'retry-streams'
> & {
  downloader: Downloader;
  'download-sections': readonly [startTime: number, endTime: number] | null;
  'retry-streams': number;
  'merge-method': MergeMethod;
};

const normalizeArgs = async (args: RawArgs['values']) => {
  const newArgs = { ...args } as unknown as AppArgs;

  newArgs.downloader = await getDownloader(args.downloader);

  newArgs['download-sections'] = parseDownloadSectionsArg(
    args['download-sections'],
  );

  if (args['retry-streams']) {
    const delay = Number.parseInt(args['retry-streams']);
    if (!delay) throw new Error('Wrong --retry-streams delay');
    if (delay < 10) throw new Error('Min --retry-streams delay is 10');
    newArgs['retry-streams'] = delay;
  }

  if (!MERGE_METHODS.includes(args['merge-method'] as any)) {
    throw new Error(`Unknown merge method. Available: ${MERGE_METHODS}`);
  }

  return newArgs;
};

const main = async () => {
  const parsedArgs = getArgs();
  const args = await normalizeArgs(parsedArgs.values);
  const positionals = parsedArgs.positionals;

  if (args.version) return showVersion();
  if (args.help || positionals.length === 0) return showHelp();

  if (positionals.length !== 1) {
    throw new Error('Expected exactly one positional argument');
  }

  if (args['merge-fragments']) return mergeFragments(positionals[0], args);

  const link = parseLink(positionals[0]);
  if (link.type === 'vodPath') return downloadByVodPath(link, args);
  if (link.type === 'video') return downloadByVideoId(link.videoId, args);
  return downloadByChannelLogin(link.channelLogin, args);
};

main().catch((e) => console.error(chalk.red('ERROR:'), e.message));
