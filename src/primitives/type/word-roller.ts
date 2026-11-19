// type/word-roller. See library/primitives/type/word-roller.md.
import { progress } from '../../core/ease.ts';
import { list, num, str, type Primitive } from '../types.ts';

export const wordRoller: Primitive = {
  slug: 'type/word-roller',
  summary: 'Words roll vertically in a slot.',
  props: {
    before: { type: 'string', default: '', label: 'Text before the slot' },
    words: { type: 'string[]', required: true, label: 'Words that take turns in the slot; the last one stays' },
    after: { type: 'string', default: '', label: 'Text after the slot' },
  },
  params: {
    per_word: { type: 'number', default: 0.9, min: 0.5, max: 1.6, step: 0.05, unit: 's', label: 'Time each word stays' },
    roll: { type: 'number', default: 0.5, min: 0.3, max: 0.7, step: 0.05, unit: 's', label: 'Time to roll to the next' },
    direction: { type: 'choice', default: 'up', options: ['up', 'down'], label: 'Roll direction' },
    style: { type: 'choice', default: 'roll', options: ['roll', 'lift'], label: 'Roll through a clipped slot, or lift: the word lifts away out of focus, a beat, the next settles in (a status line)' },
    gap: { type: 'number', default: 0.05, min: 0, max: 0.2, step: 0.01, unit: 's', label: 'For lift: the empty beat between the words' },
  },
  duration: (props, p) => Math.max(0, list(props.words).length - 1) * num(p.per_word) + num(p.roll),
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const words = list(props.words);
    const per = num(p.per_word), roll = num(p.roll), dir = p.direction === 'down' ? -1 : 1;
    const ease = ctx.ease('quint.inOut'), lift = p.style === 'lift', swap = ctx.ease('cubic.inOut');
    // A lift: out over half of what is left after the gap, the gap, then the mirror in.
    const gap = Math.min(num(p.gap), roll * 0.5), half = (roll - gap) / 2;
    el.style.whiteSpace = 'nowrap';
    const before = doc.createElement('span'), after = doc.createElement('span');
    before.textContent = str(props.before) ? `${str(props.before)} ` : '';
    after.textContent = str(props.after) ? ` ${str(props.after)}` : '';
    // The slot clips the rolling words and eases its width to the word inside it,
    // so the sentence closes up around a short word instead of leaving a gap.
    const slot = doc.createElement('span');
    slot.style.cssText = `display:inline-block;position:relative;overflow:${lift ? 'visible' : 'hidden'};vertical-align:bottom;padding:0.14em 0;margin:-0.14em 0;color:var(--m-accent)`;
    const cells = words.map((w) => {
      const c = doc.createElement('span');
      c.textContent = w;
      c.style.cssText = 'position:absolute;left:0;top:0.14em;white-space:pre';
      slot.appendChild(c);
      return c;
    });
    const probe = doc.createElement('span');
    probe.style.cssText = 'visibility:hidden;white-space:pre';
    probe.textContent = words.reduce((a, b) => (b.length > a.length ? b : a), '');
    slot.appendChild(probe);
    el.append(before, slot, after);
    const widths = cells.map((c) => c.offsetWidth);
    probe.style.display = 'inline-block';
    probe.style.width = '0px';
    return {
      seek(t) {
        // Word i rolls in over [i * per, i * per + roll] while word i - 1 rolls out.
        const i = Math.max(0, Math.min(words.length - 1, Math.floor(t / per + 1e-9)));
        const k = i === 0 ? 1 : progress(t - i * per, 0, roll, ease);
        if (lift) {
          // Out: up 8 px, into a 2 px blur, fading. In: the mirror, from below.
          const lt = t - i * per, out = i === 0 ? 1 : progress(lt, 0, half, swap), inn = i === 0 ? 1 : progress(lt, half + gap, half, swap);
          cells.forEach((c, j) => {
            const v = j === i ? 1 - inn : j === i - 1 ? -out : 1;
            const shown = j === i ? inn : j === i - 1 ? 1 - out : 0;
            c.style.visibility = shown <= 0 ? 'hidden' : 'inherit';
            c.style.opacity = shown >= 1 ? '' : shown.toFixed(4);
            c.style.transform = v === 0 ? '' : `translateY(${(dir * v * 8).toFixed(3)}px)`;
            c.style.filter = v === 0 ? '' : `blur(${(Math.abs(v) * 2).toFixed(3)}px)`;
          });
          const w = i === 0 ? widths[0]! : widths[i - 1]! + (widths[i]! - widths[i - 1]!) * k;
          slot.style.width = `${w.toFixed(2)}px`;
          return;
        }
        cells.forEach((c, j) => {
          const y = j === i ? 1 - k : j === i - 1 ? -k : 1;
          c.style.transform = y === 0 ? '' : `translateY(${(dir * y * 110).toFixed(3)}%)`;
          c.style.visibility = Math.abs(y) >= 1 ? 'hidden' : 'inherit';
        });
        const w = i === 0 ? widths[0]! : widths[i - 1]! + (widths[i]! - widths[i - 1]!) * k;
        slot.style.width = `${w.toFixed(2)}px`;
      },
    };
  },
};
