import { MERGE_METHODS, UNMUTE } from '../../constants.ts';
import type { AppArgs, RawArgs } from '../../types.ts';
import { getDownloader } from './getDownloader.ts';
import { parseDownloadSectionsArg } from './parseDownloadSectionsArg.ts';

export const normalizeArgs = async (args: RawArgs['values']) => {
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

  return newArgs;
};
