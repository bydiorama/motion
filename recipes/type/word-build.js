// Recipe for type/word-build. See library/primitives/type/word-build.md.
import { progress } from '../_lib/ease.js';

export const slug = 'type/word-build';
export const defaults = { rise: 16, stagger: 0.1, word_duration: 0.5 };

export function build(root, params = {}, ctx = {}) {
  const p = { ...defaults, ...params };
  const easeName = (ctx.tokens && ctx.tokens.ease_enter) || 'expo.out';
  const words = (ctx.copy || 'Words rise and fade in one by one').split(/\s+/);

  const line = document.createElement('div');
  line.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:0 0.28em;max-width:80%;text-align:center';
  const spans = words.map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.cssText = 'display:inline-block;will-change:transform,opacity';
    line.appendChild(s);
    return s;
  });
  root.appendChild(line);

  return {
    duration: (words.length - 1) * p.stagger + p.word_duration,
    seek(t) {
      spans.forEach((s, i) => {
        const k = progress(t, i * p.stagger, p.word_duration, easeName);
        s.style.opacity = k;
        s.style.transform = `translateY(${(1 - k) * p.rise}px)`;
        // Words not started yet take no space, so the line re-centres as it grows.
        s.style.display = t >= i * p.stagger ? 'inline-block' : 'none';
      });
    },
  };
}
