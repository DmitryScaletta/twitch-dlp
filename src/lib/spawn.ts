import childProcess from 'node:child_process';

export const spawn = (command: string, args: string[] = [], silent = false) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args);
    if (!silent) {
      child.stdout.on('data', (data) => process.stdout.write(data));
      child.stderr.on('data', (data) => process.stderr.write(data));
    }
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve(code));
  });
