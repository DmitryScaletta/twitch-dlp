import os from 'node:os';
import path from 'node:path';
import timers from 'node:timers/promises';
import { resolveExecutable } from './browser.ts';

const isWin32 = process.platform === 'win32';
const isDarwin = process.platform === 'darwin';

// https://github.com/streamlink/streamlink/blob/master/src/streamlink/webbrowser/chromium.py#L84
export const CHROMIUM_LAUNCH_ARGS = [
  // Don't auto-play videos
  '--autoplay-policy=user-gesture-required',
  // Suppress all permission prompts by automatically denying them
  '--deny-permission-prompts',
  // Disable various background network services, including
  //   extension updating, safe browsing service, upgrade detector, translate, UMA
  '--disable-background-networking',
  // Chromium treats "foreground" tabs as "backgrounded" if the surrounding window is occluded by another window
  '--disable-backgrounding-occluded-windows',
  // Disable crashdump collection (reporting is already disabled in Chromium)
  '--disable-breakpad',
  // Disables client-side phishing detection
  '--disable-client-side-phishing-detection',
  // Disable some built-in extensions that aren't affected by `--disable-extensions`
  '--disable-component-extensions-with-background-pages',
  // Don't update the browser 'components' listed at chrome://components/
  '--disable-component-update',
  // Disable installation of default apps
  '--disable-default-apps',
  // Disable all chrome extensions
  '--disable-extensions',
  // Hide toolbar button that opens dialog for controlling media sessions
  '--disable-features=GlobalMediaControls',
  // Disable the "Chrome Media Router" which creates some background network activity to discover castable targets
  '--disable-features=MediaRouter',
  // Disables Chrome translation, both the manual option and the popup prompt
  '--disable-features=Translate',
  // Suppresses hang monitor dialogs in renderer processes
  //   This flag may allow slow unload handlers on a page to prevent the tab from closing
  '--disable-hang-monitor',
  // Disables logging
  '--disable-logging',
  // Disables the Web Notification and the Push APIs
  '--disable-notifications',
  // Disable popup blocking. `--block-new-web-contents` is the strict version of this
  '--disable-popup-blocking',
  // Reloading a page that came from a POST normally prompts the user
  '--disable-prompt-on-repost',
  // Disable syncing with Google
  '--disable-sync',
  // Forces the maximum disk space to be used by the disk cache, in bytes
  '--disk-cache-size=0',
  // Disable reporting to UMA, but allows for collection
  '--metrics-recording-only',
  // Mute any audio
  '--mute-audio',
  // Disable the default browser check, do not prompt to set it as such
  '--no-default-browser-check',
  // Disables all experiments set on about:flags
  '--no-experiments',
  // Skip first run wizards
  '--no-first-run',
  // Disables the service process from adding itself as an autorun process
  //   This does not delete existing autorun registrations, it just prevents the service from registering a new one
  '--no-service-autorun',
  // Avoid potential instability of using Gnome Keyring or KDE wallet
  '--password-store=basic',
  // No initial CDP target (no empty default tab)
  // '--silent-launch', // Doesn't work for edge
  // Use mock keychain on Mac to prevent the blocking permissions dialog asking:
  //   Do you want the application "Chromium.app" to accept incoming network connections?
  '--use-mock-keychain',
  // When not using headless mode, try to disrupt the user as little as possible
  '--window-size=0,0',
];

const CHROMIUM_NAMES = [
  'chromium',
  'chromium-browser',
  'chrome',
  'google-chrome',
  'google-chrome-stable',
];

const CHROMIUM_PATHS = (() => {
  if (isWin32) {
    const msEdge: string[] = [];
    const googleChrome: string[] = [];

    const programFiles = [
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
    ].filter(Boolean);

    const localAppData = process.env.LOCALAPPDATA;

    for (const base of programFiles) {
      if (!base) continue;
      for (const sub of [
        'Microsoft\\Edge\\Application',
        'Microsoft\\Edge Beta\\Application',
        'Microsoft\\Edge Dev\\Application',
      ]) {
        msEdge.push(path.join(base, sub, 'msedge.exe'));
      }
    }

    for (const base of programFiles) {
      if (!base) continue;
      for (const sub of [
        'Google\\Chrome\\Application',
        'Google\\Chrome Beta\\Application',
        'Google\\Chrome Canary\\Application',
      ]) {
        googleChrome.push(path.join(base, sub, 'chrome.exe'));
      }
    }

    if (localAppData) {
      for (const sub of [
        'Google\\Chrome\\Application',
        'Google\\Chrome Beta\\Application',
        'Google\\Chrome Canary\\Application',
      ]) {
        googleChrome.push(path.join(localAppData, sub, 'chrome.exe'));
      }
    }

    return [...msEdge, ...googleChrome];
  }

  if (isDarwin) {
    return [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(
        os.homedir(),
        'Applications/Chromium.app/Contents/MacOS/Chromium',
      ),
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(
        os.homedir(),
        'Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ),
    ];
  }

  return [];
})();

export const getExe = (executable?: string | null) => {
  const exe = resolveExecutable(executable, CHROMIUM_NAMES, CHROMIUM_PATHS);
  if (!exe) {
    throw new Error(
      '[webbrowser] Could not find Chromium-based web browser executable',
    );
  }
  return exe;
};

export const getWsUrls = async (host: string, port: number) => {
  const wsHost = host.includes(':') ? `[${host}]` : host;
  const browserUrl = `http://${wsHost}:${port}/json/version`;
  const targetUrl = `http://${wsHost}:${port}/json/list`;

  for (let i = 0; i < 10; i++) {
    try {
      const [browserRes, targetsRes] = await Promise.all([
        fetch(browserUrl, { signal: AbortSignal.timeout(100) }),
        fetch(targetUrl, { signal: AbortSignal.timeout(100) }),
      ]);
      if (!browserRes.ok || !targetsRes.ok) continue;

      const [browser, targets] = await Promise.all([
        browserRes.json(),
        targetsRes.json(),
      ]);
      const target = Array.isArray(targets)
        ? targets.find((t: { type: string }) => t.type === 'page')
        : null;
      return {
        browserWsUrl: browser.webSocketDebuggerUrl as string,
        targetWsUrl: target?.webSocketDebuggerUrl as string,
      };
    } catch {}
    await timers.setTimeout(250);
  }

  throw new Error('[webbrowser] Failed to get websocket URL');
};
