// type/word-build. See library/primitives/type/word-build.md.
import { progress } from '../../core/ease.ts';
import { list, num, str, type Primitive } from '../types.ts';

const words = (props: Record<string, unknown>) => str(props.text).split(/\s+/).filter(Boolean);

export const wordBuild: Primitive = {
  slug: 'type/word-build',
  summary: 'Words rise and fade in one by one.',
  props: {
    text: { type: 'string', required: true, label: 'The line to build' },
    accent: { type: 'string[]', default: [], label: 'Words set in the accent colour' },
  },
  params: {
    rise: { type: 'number', default: 16, min: 12, max: 20, step: 1, unit: 'px', label: 'Rise' },
    stagger: { type: 'number', default: 0.1, min: 0.08, max: 0.12, step: 0.005, unit: 's', label: 'Delay between words' },
    word_duration: { type: 'number', default: 0.5, min: 0.3, max: 0.6, step: 0.01, unit: 's', label: 'Time per word' },
  },
  duration: (props, p) => Math.max(0, words(props).length - 1) * num(p.stagger) + num(p.word_duration),
  build(el, props, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_enter);
    const accent = new Set(list(props.accent).map((w) => w.toLowerCase()));
    el.style.cssText += ';display:flex;flex-wrap:wrap;justify-content:center;gap:0 0.26em';
    const spans = words(props).map((w) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.style.cssText = 'display:inline-block;will-change:transform,opacity';
      if (accent.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) s.style.color = 'var(--m-accent)';
      el.appendChild(s);
      return s;
    });
    // Every word has its place from the first frame: the line is laid out whole, so it
    // never re-wraps or re-centres as words arrive, and nothing around it moves.
    const stagger = num(p.stagger), dur = num(p.word_duration), rise = num(p.rise);
    return {
      seek(t) {
        spans.forEach((s, i) => {
          const k = progress(t, i * stagger, dur, ease);
          s.style.opacity = String(Math.min(1, k * 1.6));
          s.style.transform = `translateY(${(1 - k) * rise}px)`;
        });
      },
    };
  },
};
