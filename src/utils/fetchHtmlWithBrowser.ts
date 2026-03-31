import type childProcess from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import timers from 'node:timers/promises';
import { launch } from '../browsers/browser.ts';
import {
  getWsUrls,
  CHROMIUM_LAUNCH_ARGS,
  getExe,
} from '../browsers/chromium.ts';
import { CDP } from '../lib/cdp.ts';
import type { AppArgs } from '../types.ts';

const DOCUMENT_WAIT_TIMEOUT = 10_000;

const cleanupBrowser = async (
  browser: CDP | null,
  browserExe: childProcess.ChildProcess,
  userDataDir: string,
) => {
  console.log('[webbrowser] Closing browser');

  if (browser) {
    try {
      await browser.send('Browser.close');
    } catch {}
  }

  if (!browserExe.killed) {
    const waitForExit = new Promise((resolve) => {
      browserExe.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    browserExe.kill();
    await waitForExit;
  }

  // Give OS time to release file handles
  await timers.setTimeout(500);

  try {
    console.log('[webbrowser] Removing temporary user-data-dir');
    await fsp.rm(userDataDir, { recursive: true, force: true });
    console.log('[webbrowser] Temporary user-data-dir removed');
  } catch (e: any) {
    console.warn('[webbrowser] Error removing user-data-dir:', e.message);
    console.warn(`[webbrowser] Please remove it manually: ${userDataDir}`);
  }
};

export const fetchHtmlWithBrowser = async (url: string, args: AppArgs) => {
  const exe = getExe(args['webbrowser-executable']);
  const host = args['webbrowser-cdp-host'];
  const port = args['webbrowser-cdp-port'];
  const timeout = args['webbrowser-timeout'] * 1000;
  const cdpTimeout = args['webbrowser-cdp-timeout'] * 1000;

  console.log('[webbrowser] Creating temporary user-data-dir');
  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'twitch-dlp-'));

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

    console.log(`[webbrowser] Navigating to ${url}`);
    await page.send('Page.navigate', { url });

    console.log('[webbrowser] Waiting for document response');
    const requestId = await requestIdPromise;
    console.log('[webbrowser] Getting document body');
    const response = await page.send('Network.getResponseBody', {
      requestId,
    });
    return response.base64Encoded
      ? Buffer.from(response.body, 'base64').toString('utf8')
      : response.body;
  } finally {
    await cleanupBrowser(browser, browserExe, userDataDir);
  }
};
