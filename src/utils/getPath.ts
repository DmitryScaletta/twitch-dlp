import path from 'node:path';
import type { VideoInfo } from '../types.ts';

export const getPath = {
  output: (template: string, videoInfo: VideoInfo) => {
    let finalTemplate = template;
    for (const [name, value] of Object.entries(videoInfo)) {
      let newValue = value ? String(value) : '';
      if (name.endsWith('_date')) newValue = newValue.slice(0, 10);
      finalTemplate = finalTemplate.replaceAll(`%(${name})s`, newValue);
    }
    const parsed = path.parse(finalTemplate);
    parsed.base = parsed.base.replace(/[/\\?%*:|"'<>]/g, '');
    return path.resolve(path.format(parsed));
  },
  ffconcat: (filePath: string) => `${filePath}-ffconcat.txt`,
  playlist: (filePath: string) => `${filePath}-playlist.txt`,
  frag: (filePath: string, i: number) => `${filePath}.part-Frag${i}`,
};
