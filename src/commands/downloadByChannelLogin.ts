import { setTimeout as sleep } from 'node:timers/promises';
import * as api from '../api/twitch.ts';
import type { AppArgs } from '../types.ts';
import { downloadVideo } from '../utils/downloadVideo.ts';
import { downloadWithStreamlink } from '../utils/downloadWithStreamlink.ts';
import { getLiveVideoInfo } from '../utils/getLiveVideoInfo.ts';

export const downloadByChannelLogin = async (
  channelLogin: string,
  args: AppArgs,
) => {
  const delay = args['retry-streams'];
  const isLiveFromStart = args['live-from-start'];
  const isRetry = delay > 0;

  while (true) {
    const streamMeta = await api.getStreamMetadata(channelLogin);
    const isLive = !!streamMeta?.stream;
    if (!isLive) {
      if (isRetry) {
        console.log(
          `[retry-streams] Waiting for streams. Retry every ${delay} second(s)`,
        );
      } else {
        console.warn('[download] The channel is not currently live');
        return;
      }
    }

    // not from start
    if (isLive && !isLiveFromStart) {
      await downloadWithStreamlink(
        `https://www.twitch.tv/${channelLogin}`,
        streamMeta,
        channelLogin,
        args,
      );
    }

    // from start
    if (isLive && isLiveFromStart) {
      const liveVideoInfo = await getLiveVideoInfo(streamMeta, channelLogin);
      if (liveVideoInfo) {
        const { formats, videoInfo } = liveVideoInfo;
        await downloadVideo(formats, videoInfo, args);
        if (args['download-sections']) return;
      } else {
        let message = `[live-from-start] Cannot find the playlist`;
        if (isRetry) {
          message += `. Retry every ${delay} second(s)`;
          console.warn(message);
        } else {
          console.warn(message);
          return;
        }
      }
    }

    await sleep(delay * 1000);
  }
};
