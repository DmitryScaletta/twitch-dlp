import { chalk } from '../lib/chalk.ts';
import type { FragMetadata } from '../types.ts';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const LOCALE = 'en-GB';

const percentFmt = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
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
  downloadedFrags: Map<number, FragMetadata>,
  fragsCount: number,
) => {
  const dlFrags = downloadedFrags.values().toArray();

  const dlSize = dlFrags.reduce((acc, f) => acc + f.size, 0);
  const avgFragSize = dlFrags.length ? dlSize / dlFrags.length : 0;
  const last5 = dlFrags.filter((f) => f.time !== 0).slice(-5);
  const currentSpeedBps = last5.length
    ? last5.map((f) => (f.size / f.time) * 1000).reduce((a, b) => a + b, 0) /
      last5.length
    : 0;

  const estFullSize = avgFragSize * fragsCount;
  const estSizeLeft = estFullSize - dlSize;
  let estTimeLeftSec = currentSpeedBps ? estSizeLeft / currentSpeedBps : 0;
  let downloadedPercent = estFullSize ? dlSize / estFullSize : 0;

  downloadedPercent = Math.min(100, downloadedPercent) || 0;
  if (estTimeLeftSec < 0) estTimeLeftSec = 0;

  const progress = [
    '[download] ',
    chalk.cyan(percentFmt.format(downloadedPercent).padStart(6, ' ')),
    ' of ~ ',
    formatSize(estFullSize || 0).padStart(9, ' '),
    ' at ',
    chalk.green(formatSpeed(currentSpeedBps || 0).padStart(11, ' ')),
    ' ETA ',
    chalk.yellow(timeFmt.format(estTimeLeftSec * 1000)),
    ` (frag ${dlFrags.length}/${fragsCount})\r`,
  ].join('');
  process.stdout.write(progress);
};
