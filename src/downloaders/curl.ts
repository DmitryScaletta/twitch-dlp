import childProcess from 'node:child_process';

const getIsUrlsAvailableCurl = (
  urls: string[],
  gzip: boolean,
): Promise<boolean[]> =>
  new Promise((resolve) => {
    // prettier-ignore
    const args: string[] = [
      '--parallel',
      '--parallel-immediate',
      '--parallel-max', '10',
      '--head',
      '-s',
      '-w', '["%{url_effective}","%{http_code}"]\r\n',
    ];
    if (gzip) args.push('-H', 'Accept-Encoding: deflate, gzip');
    args.push(...urls);

    const child = childProcess.spawn('curl', args);
    let data = '';
    child.stdout.on('data', (chunk) => (data += chunk));
    child.on('error', () => resolve([]));
    child.on('close', () => {
      const responses = data
        .split('\r\n')
        .filter((line) => line.startsWith('["'))
        .map((line) => JSON.parse(line) as [string, string]);
      const result: boolean[] = [];
      for (const url of urls) {
        const response = responses.find((res) => res[0] === url);
        if (!response) result.push(false);
        else result.push(response[1] === '200');
      }
      resolve(result);
    });
  });

export const isUrlsAvailable = async (
  urls: string[],
): Promise<[noGzip: boolean, gzip: boolean][]> => {
  const [urlsNoGzip, urlsGzip] = await Promise.all([
    getIsUrlsAvailableCurl(urls, false),
    getIsUrlsAvailableCurl(urls, true),
  ]);
  return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]] as const);
};

export const downloadFile = async (
  url: string,
  destPath: string,
  retries: number,
  rateLimit = '0',
  gzip = false,
): Promise<boolean> =>
  new Promise((resolve) => {
    // prettier-ignore
    const args: string[] = [
      '-o', destPath,
      '--retry', `${retries}`,
      '--retry-delay', '1',
      '--limit-rate', rateLimit,
      url,
    ]
    if (gzip) args.push('-H', 'Accept-Encoding: deflate, gzip');
    const child = childProcess.spawn('curl', args);
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
