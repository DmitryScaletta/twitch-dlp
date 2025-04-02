import path from 'node:path';
import type { VideoInfo } from '../types.ts';

export const getPath = {
  output: (template: string, videoInfo: VideoInfo) => {
    let finalTemplate = template;
    for (const [name, value] of Object.entries(videoInfo)) {
      let newValue = value ? String(value) : '';
      if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
      newValue = newValue.replace(/[/\\?%*:|"'<>]/g, '');
      finalTemplate = finalTemplate.replaceAll(`%(${name})s`, newValue);
    }
    return path.resolve(finalTemplate);
  },
  ffconcat: (filePath: string) => `${filePath}-ffconcat.txt`,
  playlist: (filePath: string) => `${filePath}-playlist.m3u8`,
  frag: (filePath: string, i: number) => `${filePath}.part-Frag${i}`,
  fragUnmuted: (fragPath: string) => `${fragPath}-unmuted`,
};
