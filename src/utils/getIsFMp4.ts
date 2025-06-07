import type { Frag } from '../types.ts';

export const getIsFMp4 = (frags: Frag[]) => !!frags[0]?.isMap;
