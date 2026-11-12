// type/typed-title. See library/primitives/type/typed-title.md.
import { num, str, type Primitive } from '../types.ts';

export const typedTitle: Primitive = {
  slug: 'type/typed-title',
  summary: 'Characters appear one by one with a caret.',
  props: { text: { type: 'string', required: true, label: 'The text to type' } },
  params: {
    chars_per_s: { type: 'number', default: 20, min: 12, max: 30, step: 1, unit: 'chars/s', label: 'Typing speed' },
  },
  duration: (props, p) => [...str(props.text)].length / Math.max(1, num(p.chars_per_s)),
  build(el, props, p) {
    const chars = [...str(props.text)];
    const cps = Math.max(1, num(p.chars_per_s));
    const typed = document.createElement('span');
    const rest = document.createElement('span');
    const caret = document.createElement('span');
    // The untyped part keeps its space, so the line does not move while it is typed.
    rest.style.visibility = 'hidden';
    caret.style.cssText = 'display:inline-block;width:0.06em;height:1em;margin:0 -0.03em;vertical-align:-0.12em;background:var(--m-accent)';
    el.style.whiteSpace = 'pre-wrap';
    el.append(typed, caret, rest);
    return {
      seek(t) {
        const n = Math.min(chars.length, Math.floor(t * cps + 1e-6));
        typed.textContent = chars.slice(0, n).join('');
        rest.textContent = chars.slice(n).join('');
        // Solid while typing; blinks at 1 Hz once typing has stopped.
        const idle = t - chars.length / cps;
        caret.style.opacity = idle > 0 && idle % 1 >= 0.5 ? '0' : '1';
      },
    };
  },
};
