import assert from 'node:assert/strict';
import { MERGE_METHODS, UNMUTE } from '../../constants.ts';
import type { AppArgs, RawArgs } from '../../types.ts';
import { getDownloader } from './getDownloader.ts';
import { parseDownloadSectionsArg } from './parseDownloadSectionsArg.ts';

const BOOL_TRUE = ['true', 'yes', '1', 'on'];
const BOOL_FALSE = ['false', 'no', '0', 'off'];

const parseBoolLike = (value: string) => {
  if (value !== undefined) {
    const lower = value.toLowerCase();
    if (BOOL_TRUE.includes(lower)) return true;
    if (BOOL_FALSE.includes(lower)) return false;
  }
  throw new Error(
    `Invalid boolean-like value: ${value}. Available: ${[...BOOL_TRUE, ...BOOL_FALSE].join(', ')}`,
  );
};

const isPositiveInt = (n: number) =>
  !Number.isNaN(n) && Number.isFinite(n) && n > 0;

const assertArg = (
  args: RawArgs['values'],
  name: keyof RawArgs['values'],
  value: any,
) => {
  assert(value, `Invalid ${name} value: ${args[name]}`);
};

export const normalizeArgs = async (args: RawArgs['values']) => {
  const newArgs = { ...args } as unknown as AppArgs;

  newArgs.downloader = await getDownloader(args.downloader);

  const dlSections = parseDownloadSectionsArg(args['download-sections']);
  newArgs['download-sections'] = dlSections;

  if (args['retry-streams']) {
    const delay = Number.parseInt(args['retry-streams']);
    assertArg(args, 'retry-streams', isPositiveInt(delay));
    const RETRY_STREAMS_MIN = 10;
    if (delay < RETRY_STREAMS_MIN) {
      throw new Error(`Min --retry-streams delay is ${RETRY_STREAMS_MIN}`);
    }
    newArgs['retry-streams'] = delay;
  }

  if (!(MERGE_METHODS as readonly string[]).includes(args['merge-method'])) {
    throw new Error(
      `Unknown merge method: ${args['merge-method']}. Available: ${MERGE_METHODS.join(', ')}`,
    );
  }

  const unmuteValues = Object.values(UNMUTE);
  if (args['unmute'] && !unmuteValues.includes(args['unmute'] as any)) {
    throw new Error(
      `Unknown unmute policy: ${args['unmute']}. Available: ${unmuteValues.join(', ')}`,
    );
  }

  newArgs.webbrowser = parseBoolLike(args.webbrowser);
  newArgs['webbrowser-headless'] = parseBoolLike(args['webbrowser-headless']);

  const wbTimeout = Number.parseInt(args['webbrowser-timeout']);
  const wbCdpTimeout = Number.parseInt(args['webbrowser-cdp-timeout']);
  const wbCdpPort = Number.parseInt(args['webbrowser-cdp-port']);

  assertArg(args, 'webbrowser-timeout', isPositiveInt(wbTimeout));
  assertArg(args, 'webbrowser-cdp-timeout', isPositiveInt(wbCdpTimeout));
  assertArg(args, 'webbrowser-cdp-port', isPositiveInt(wbCdpPort));

  newArgs['webbrowser-timeout'] = wbTimeout;
  newArgs['webbrowser-cdp-timeout'] = wbCdpTimeout;
  newArgs['webbrowser-cdp-port'] = wbCdpPort;

  return newArgs;
};
