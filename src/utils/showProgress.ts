import { COLOR } from '../constants.ts';
import type { FragMetadata } from '../types.ts';

const LOCALE = 'en-US';
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZone: 'GMT',
});

const formatSpeed = (n: number) => {
  const i = n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(2)}${UNITS[i]}/s`;
};

const formatSize = (n: number) => {
  const i = n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
  const value = n / Math.pow(1024, i);
  return `${value.toFixed(2)}${UNITS[i]}`;
};

export const showProgress = (
  downloadedFrags: FragMetadata[],
  fragsCount: number,
) => {
  const downloadedSize = downloadedFrags.reduce((acc, f) => acc + f.size, 0);
  const avgFragSize =
    downloadedFrags.length === 0 ? 0 : downloadedSize / downloadedFrags.length;
  const last5frags = downloadedFrags.filter((f) => f.time !== 0).slice(-5);
  const currentSpeedBps =
    last5frags.length === 0
      ? 0
      : last5frags
          .map((f) => (f.size / f.time) * 1000)
          .reduce((a, b) => a + b, 0) / last5frags.length;

  const estFullSize = avgFragSize * fragsCount;
  const estSizeLeft = estFullSize - downloadedSize;
  let estTimeLeftSec =
    currentSpeedBps === 0 ? 0 : estSizeLeft / currentSpeedBps;
  let downloadedPercent = estFullSize === 0 ? 0 : downloadedSize / estFullSize;

  const progress = [
    '[download]',
    COLOR.cyan,
    percentFormatter.format(downloadedPercent || 0).padStart(7, ' '),
    COLOR.reset,
    ' of ~ ',
    formatSize(estFullSize || 0).padStart(9, ' '),
    ' at ',
    COLOR.green,
    formatSpeed(currentSpeedBps || 0).padStart(11, ' '),
    COLOR.reset,
    ' ETA ',
    COLOR.yellow,
    timeFormatter.format((estTimeLeftSec || 0) * 1000),
    COLOR.reset,
    ` (frag ${downloadedFrags.length}/${fragsCount})\r`,
  ].join('');
  process.stdout.write(progress);
};
