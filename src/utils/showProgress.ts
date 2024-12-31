import type { Frag, FragMetadata } from '../types.ts';

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

export const showProgress = (
  frags: Frag[],
  fragsMetadata: FragMetadata[],
  currentFragIdx: number,
) => {
  const fragsFullSize = fragsMetadata.reduce((acc, f) => acc + f.size, 0);
  const avgFragSize = fragsFullSize / fragsMetadata.length;
  const last5frags = fragsMetadata.slice(-5);
  const currentSpeedBps =
    last5frags.map((f) => (f.size / f.time) * 1000).reduce((a, b) => a + b, 0) /
    last5frags.length;

  const estFullSize = avgFragSize * frags.length;
  const estDownloadedSize = avgFragSize * (currentFragIdx + 1);
  const estSizeLeft = estFullSize - estDownloadedSize;
  let estTimeLeftSec = estSizeLeft / currentSpeedBps;
  let downloadedPercent = estDownloadedSize / estFullSize;

  if (estTimeLeftSec < 0 || Number.isNaN(estTimeLeftSec)) estTimeLeftSec = 0;
  if (downloadedPercent > 1) downloadedPercent = 1;

  const getValueAndUnit = (n: number) => {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'];
    const i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
    const value = n / Math.pow(1024, i);
    return { value, unit: units[i] };
  };

  const estSize = getValueAndUnit(estFullSize || 0);
  const currentSpeed = getValueAndUnit(currentSpeedBps || 0);

  const LOCALE = 'en-US';
  const progress = [
    `[download]${COLOR.cyan}`,
    new Intl.NumberFormat(LOCALE, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .format(downloadedPercent || 0)
      .padStart(6, ' '),
    `${COLOR.reset}of ~`,
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: estSize.unit,
      unitDisplay: 'narrow',
    })
      .format(estSize.value)
      .padStart(9, ' '),
    `at${COLOR.green}`,
    new Intl.NumberFormat(LOCALE, {
      notation: 'compact',
      style: 'unit',
      unit: `${currentSpeed.unit}-per-second`,
      unitDisplay: 'narrow',
    })
      .format(currentSpeed.value)
      .padStart(11, ' '),
    `${COLOR.reset}ETA${COLOR.yellow}`,
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'GMT',
    }).format((estTimeLeftSec || 0) * 1000),
    `${COLOR.reset}(frag ${currentFragIdx}/${frags.length})\r`,
  ].join(' ');
  process.stdout.write(progress);
};
