#!/usr/bin/env node
import http from 'node:http';
import { parseArgs } from 'node:util';
import { downloadByChannelLogin } from './commands/downloadByChannelLogin.ts';
import { downloadByStatsService } from './commands/downloadByStatsService.ts';
import { downloadByVideoId } from './commands/downloadByVideoId.ts';
import { downloadByVodPath } from './commands/downloadByVodPath.ts';
import { downloadClip } from './commands/downloadClip.ts';
import { mergeFragments } from './commands/mergeFragments.ts';
import { showHelp } from './commands/showHelp.ts';
import { showVersion } from './commands/showVersion.ts';
import { chalk } from './lib/chalk.ts';
import { normalizeArgs } from './utils/args/normalizeArgs.ts';
import { parseLink } from './utils/args/parseLink.ts';

export const getArgs = () =>
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
      proxy: {
        type: 'string',
      },
      'keep-fragments': {
        type: 'boolean',
        default: false,
      },
      'keep-log': {
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

const main = async () => {
  const parsedArgs = getArgs();
  const args = await normalizeArgs(parsedArgs.values);
  const positionals = parsedArgs.positionals;

  if (args.version) return showVersion();
  if (args.help || positionals.length === 0) return showHelp();

  if (positionals.length !== 1) {
    throw new Error('Expected exactly one positional argument');
  }

  // Node.js v25.4.0+
  // @ts-ignore wait for @types/node to be updated
  http.setGlobalProxyFromEnv?.(
    args.proxy
      ? { http_proxy: args.proxy, https_proxy: args.proxy }
      : undefined,
  );

  if (args['merge-fragments']) return mergeFragments(positionals[0], args);

  const link = parseLink(positionals[0]);
  if (link.type === 'vodPath') return downloadByVodPath(link, args);
  if (link.type === 'video') return downloadByVideoId(link.videoId, args);
  if (link.type === 'clip') return downloadClip(link.slug, args);
  // prettier-ignore
  if (link.type === 'channel') return downloadByChannelLogin(link.channelLogin, args);
  if (link.type === 'statsService') return downloadByStatsService(link, args);
};

main().catch((e) => console.error(chalk.red('ERROR:'), e.message));
