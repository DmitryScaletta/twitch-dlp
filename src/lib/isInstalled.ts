import childProcess from 'node:child_process';

export const isInstalled = (cmd: string): Promise<boolean> =>
  new Promise((resolve) => {
    const child = childProcess.spawn(cmd);
    child.on('error', (e: any) => resolve(e.code !== 'ENOENT'));
    child.on('close', () => resolve(true));
  });
