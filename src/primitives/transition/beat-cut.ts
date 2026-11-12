// transition/beat-cut. See library/primitives/transition/beat-cut.md.
import type { TransitionPrimitive } from '../types.ts';

export const beatCut: TransitionPrimitive = {
  slug: 'transition/beat-cut',
  summary: 'A plain cut placed on a music beat.',
  duration: 0,
  params: {
    duration: { type: 'number', default: 0, min: 0, max: 0, step: 0, unit: 's', label: 'Always zero: a cut' },
  },
  apply() {},
  clear() {},
};
