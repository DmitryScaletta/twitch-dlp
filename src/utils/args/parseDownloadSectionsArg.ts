const DOWNLOAD_SECTIONS_ERROR = 'Wrong --download-sections syntax';
// https://regex101.com/r/d0kteE/1
const DOWNLOAD_SECTIONS_REGEX =
  /^\*(?:(?:(?<startH>\d{1,2}):)?(?<startM>\d{1,2}):)?(?:(?<startS>\d{1,2}))-(?:(?:(?:(?<endH>\d{1,2}):)?(?<endM>\d{1,2}):)?(?:(?<endS>\d{1,2}))|(?<inf>inf))$/;

type DownloadSectionsGroups = {
  startH?: string;
  startM?: string;
  startS: string;
  endH?: string;
  endM?: string;
  endS?: string;
  inf?: 'inf';
};

export const parseDownloadSectionsArg = (downloadSectionsArg?: string) => {
  if (!downloadSectionsArg) return null;
  const m = downloadSectionsArg.match(DOWNLOAD_SECTIONS_REGEX);
  if (!m) throw new Error(DOWNLOAD_SECTIONS_ERROR);
  const { startH, startM, startS, endH, endM, endS, inf } =
    m.groups as DownloadSectionsGroups;
  const startHN = startH ? Number.parseInt(startH) : 0;
  const startMN = startM ? Number.parseInt(startM) : 0;
  const startSN = startS ? Number.parseInt(startS) : 0;
  const endHN = endH ? Number.parseInt(endH) : 0;
  const endMN = endM ? Number.parseInt(endM) : 0;
  const endSN = endS ? Number.parseInt(endS) : 0;
  if (startMN >= 60 || startSN >= 60 || endMN >= 60 || endSN >= 60) {
    throw new Error(DOWNLOAD_SECTIONS_ERROR);
  }
  const startTime = startSN + startMN * 60 + startHN * 60 * 60;
  const endTime = inf ? Infinity : endSN + endMN * 60 + endHN * 60 * 60;
  if (startTime >= endTime) throw new Error(DOWNLOAD_SECTIONS_ERROR);
  return [startTime, endTime] as const;
};
