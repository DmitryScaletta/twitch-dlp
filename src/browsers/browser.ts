import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const checkExecutable = (executable: string) => {
  try {
    fs.accessSync(executable);
    return true;
  } catch {
    return false;
  }
};

const findExecutable = (name: string) => {
  const pathEnv = process.env.PATH ?? '';
  const pathDirs = pathEnv.split(process.platform === 'win32' ? ';' : ':');

  for (const dir of pathDirs) {
    const fullPath = path.join(dir, name);
    if (checkExecutable(fullPath)) return fullPath;
    if (process.platform === 'win32' && checkExecutable(fullPath + '.exe'))
      return fullPath + '.exe';
  }

  return null;
};

export const resolveExecutable = (
  executable: string | null | undefined,
  names: string[],
  fallback_paths: string[],
) => {
  if (executable) {
    return checkExecutable(executable) ? executable : null;
  }

  for (const name of names) {
    const found = findExecutable(name);
    if (found) return found;
  }

  for (const fallback of fallback_paths) {
    if (checkExecutable(fallback)) return fallback;
  }

  return null;
};

export const launch = (
  executable: string,
  args: string[],
  timeoutMs: number | null = null,
) => {
  console.log(`[webbrowser] Launching web browser: ${executable}`);
  console.log(
    "[webbrowser] NOTE: If this browser is already running in the background, it will ignore the `--remote-debugging-*` flags and won't work",
  );

  const proc = childProcess.spawn(executable, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let timeout = null;
  if (timeoutMs) {
    timeout = setTimeout(() => {
      proc.kill();
      console.warn(
        '[webbrowser] Timeout reached. The browser process has been killed.',
      );
    }, timeoutMs);
  }

  proc.on('close', () => {
    if (timeout) clearTimeout(timeout);
  });

  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  return proc;
};
