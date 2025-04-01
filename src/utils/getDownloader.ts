import os from 'node:os';
import { isInstalled } from '../lib/isInstalled.ts';
import { DOWNLOADERS } from '../constants.ts';

const FETCH_WARNING =
  'Warning: --limit-rate (-r) option is not supported by default downloader. Install aria2c or curl';
const [ARIA2C, CURL, FETCH] = DOWNLOADERS;

export const getDownloader = async (
  downloaderArg?: string,
  limitRateArg?: string,
) => {
  if (downloaderArg === FETCH) {
    if (!limitRateArg) return FETCH;
    console.warn(FETCH_WARNING);
    return FETCH;
  }

  if (!downloaderArg) {
    if (!limitRateArg) return FETCH;
    const [aria2cInstalled, curlInstalled] = await Promise.all([
      isInstalled(ARIA2C),
      isInstalled(CURL),
    ]);
    if (curlInstalled) return CURL;
    if (aria2cInstalled) return ARIA2C;
    console.warn(FETCH_WARNING);
    return FETCH;
  }

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
