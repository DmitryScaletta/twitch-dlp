import os from 'node:os';
import { DOWNLOADERS } from '../../constants.ts';
import { isInstalled } from '../../lib/isInstalled.ts';

const [ARIA2C, CURL, FETCH] = DOWNLOADERS;

export const getDownloader = async (downloaderArg: string) => {
  if (downloaderArg === FETCH) return FETCH;

  if (downloaderArg === ARIA2C) {
    if (await isInstalled(ARIA2C)) return ARIA2C;
    throw new Error(
      `${ARIA2C} is not installed. Install it from https://aria2.github.io/`,
    );
  }

  if (downloaderArg === CURL) {
    if (await isInstalled(CURL)) return CURL;
    const curlLink =
      os.platform() === 'win32'
        ? 'https://curl.se/windows/'
        : 'https://curl.se/download.html';
    throw new Error(`${CURL} is not installed. Install it from ${curlLink}`);
  }

  throw new Error(
    `Unknown downloader: ${downloaderArg}. Available: ${DOWNLOADERS}`,
  );
};
