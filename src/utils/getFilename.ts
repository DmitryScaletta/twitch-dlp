import path from 'node:path';
import type { VideoInfo } from '../types.ts';

export const getFilename = {
  output: (template: string, videoInfo: VideoInfo) => {
    let outputFilename = template;
    for (const [name, value] of Object.entries(videoInfo)) {
      let newValue = value ? String(value) : '';
      if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
      outputFilename = outputFilename.replaceAll(`%(${name})s`, newValue);
    }
    return path.resolve('.', outputFilename.replace(/[/\\?%*:|"'<>]/g, ''));
  },
  ffconcat: (filename: string) => `${filename}-ffconcat.txt`,
  playlist: (filename: string) => `${filename}-playlist.txt`,
  frag: (filename: string, i: number) => `${filename}.part-Frag${i}`,
};
