import fsp from 'node:fs/promises';
import timers from 'node:timers/promises';
import { createTempDir, launch } from '../browsers/browser.ts';
import {
  getWsUrls,
  CHROMIUM_LAUNCH_ARGS,
  getExe,
} from '../browsers/chromium.ts';
import { CDP } from '../lib/cdp.ts';
import type { AppArgs } from '../types.ts';

const DOCUMENT_WAIT_TIMEOUT = 10_000;

export const fetchHtmlWithBrowser = async (url: string, args: AppArgs) => {
  const exe = getExe(args['webbrowser-executable']);
  const host = args['webbrowser-cdp-host'];
  const port = args['webbrowser-cdp-port'];
  const timeout = args['webbrowser-timeout'] * 1000;
  const cdpTimeout = args['webbrowser-cdp-timeout'] * 1000;

  const userDataDir = createTempDir();
  const launchArgs = [...CHROMIUM_LAUNCH_ARGS];
  if (args['webbrowser-headless']) launchArgs.push('--headless=new');
  launchArgs.push(
    `--remote-debugging-host=${host}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
  );

  const browserExe = launch(exe, launchArgs, timeout);

  let browser: CDP | null = null;

  try {
    const { browserWsUrl, targetWsUrl } = await getWsUrls(host, port);
    browser = CDP.create();
    const page = CDP.create();

    await Promise.all([
      browser.connect(browserWsUrl, cdpTimeout),
      page.connect(targetWsUrl, cdpTimeout),
    ]);

    await Promise.all([page.send('Page.enable'), page.send('Network.enable')]);

    const requestIdPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        reject,
        DOCUMENT_WAIT_TIMEOUT,
        '[webbrowser] Timeout waiting for document',
      );
      page.on('Network.responseReceived', (p) => {
        if (
          p.type === 'Document' &&
          p.response.url === url &&
          p.response.status === 200
        ) {
          const requestId = p.requestId;
          page.on('Network.loadingFinished', (p) => {
            clearTimeout(timeout);
            if (p.requestId === requestId) resolve(p.requestId);
          });
        }
      });
    });

    await page.send('Page.navigate', { url });

    const requestId = await requestIdPromise;
    const response = await page.send('Network.getResponseBody', {
      requestId,
    });
    return response.base64Encoded
      ? Buffer.from(response.body, 'base64').toString('utf8')
      : response.body;
  } catch (e) {
    throw e;
  } finally {
    await browser?.send('Browser.close');
    browserExe.kill();
    await timers.setTimeout(500);
    await fsp.rm(userDataDir, { recursive: true, force: true });
  }
};
