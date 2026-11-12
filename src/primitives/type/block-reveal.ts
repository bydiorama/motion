// type/block-reveal. See library/primitives/type/block-reveal.md.
import { progress } from '../../core/ease.ts';
import { staggerDelays } from '../../core/stagger.ts';
import { countHardLines, splitText } from '../split.ts';
import { list, num, str, type Primitive } from '../types.ts';

const FILL: Record<string, string> = { accent: 'var(--m-bg-accent)', inverse: 'var(--m-bg-inverse)', primary: 'var(--m-text-primary)' };

export const blockReveal: Primitive = {
  slug: 'type/block-reveal',
  summary: 'A solid block covers each line, then retracts as the line slides out from behind it.',
  props: {
    text: { type: 'string', required: true, label: 'The text. Use \\n to set the line breaks' },
    accent: { type: 'string[]', default: [], label: 'Words set in the accent colour' },
    fill: { type: 'string', default: 'accent', label: 'Block colour: accent, inverse, primary or a CSS colour' },
  },
  params: {
    duration: { type: 'number', default: 0.8, min: 0.5, max: 1.2, step: 0.05, unit: 's', label: 'Time for one block to grow and retract' },
    stagger: { type: 'number', default: 0.08, min: 0.03, max: 0.2, step: 0.01, unit: 's', label: 'Delay between lines' },
    direction: { type: 'choice', default: 'right', options: ['right', 'left'], label: 'Which way the block travels' },
  },
  // Each line: the block grows, then retracts; the text slides out from 0.35 of the way into the retract.
  duration: (props, p) => (countHardLines(str(props.text)) - 1) * num(p.stagger) + num(p.duration) * 2.35,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const { lines } = splitText(el, str(props.text), { accent: list(props.accent) });
    const right = str(p.direction) !== 'left';
    const fill = FILL[str(props.fill, 'accent')] ?? str(props.fill, 'accent');
    // Each line hugs its words, so the block is exactly the line's own width.
    const units = lines.map((line) => {
      line.style.cssText += ';position:relative;display:block;width:fit-content;margin-inline:auto;text-align:inherit';
      const block = doc.createElement('span');
      block.setAttribute('aria-hidden', 'true');
      block.style.cssText = `position:absolute;inset:0.06em -0.08em;border-radius:0.06em;background:${fill};transform:scaleX(0)`;
      const words = doc.createElement('span');
      words.style.cssText = 'display:inline-block';
      while (line.firstChild) words.appendChild(line.firstChild);
      line.append(words, block);
      return { block, words };
    });
    // Lines that wrap share the time the "\n" lines were given.
    const budget = (countHardLines(str(props.text)) - 1) * num(p.stagger);
    const delays = staggerDelays(units.length, units.length > 1 ? Math.min(num(p.stagger), budget / (units.length - 1)) : 0);
    const dur = num(p.duration), grow = ctx.ease('expo.inOut'), land = ctx.ease('snap.out');
    return {
      seek(t) {
        units.forEach(({ block, words }, i) => {
          const g = progress(t, delays[i]!, dur, grow);
          const r = progress(t, delays[i]! + dur, dur, grow);
          // Grows from one side, retracts toward the other.
          block.style.transformOrigin = r > 0 ? (right ? '100% 50%' : '0% 50%') : (right ? '0% 50%' : '100% 50%');
          block.style.transform = `scaleX(${(r > 0 ? 1 - r : g).toFixed(4)})`;
          const k = progress(t, delays[i]! + dur * 1.35, dur, land);
          const shown = t >= delays[i]! + dur;
          words.style.visibility = shown ? 'inherit' : 'hidden';
          words.style.transform = k >= 1 ? '' : `translateX(${((right ? -1 : 1) * (1 - k) * 0.6).toFixed(4)}em)`;
          words.style.opacity = shown ? Math.min(1, 0.4 + k).toFixed(3) : '0';
        });
      },
    };
  },
};
