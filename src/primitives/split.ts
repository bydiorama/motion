// Splits a line of text into lines, words and characters that can be moved one by
// one. Lines are found by laying the words out once at their final size, so they
// break exactly where the finished text breaks; a "\n" in the text forces a break.
//
// A masked unit clips its own content: text that rises inside it appears to come
// from under an edge. The mask is padded so descenders and accents are not cut.

export type MaskUnit = 'none' | 'line' | 'word';

export interface SplitOptions {
  /** Wrap each character in its own span. */
  chars?: boolean;
  /** Clip each line or each word, for reveals from under an edge. */
  mask?: MaskUnit;
  /** Words (lower case, no punctuation) set in the accent colour. */
  accent?: Iterable<string>;
  /**
   * A soft bottom edge on each mask, in em: the mask grows by this much below its padding and
   * fades out over it, so text rises out of a soft edge. Nothing at rest sits in the ramp.
   */
  feather?: number;
}

export interface SplitText {
  /** The movable element of each line (inside its mask, when masked). */
  lines: HTMLElement[];
  /** The movable element of each word (inside its mask, when masked). */
  words: HTMLElement[];
  chars: HTMLElement[];
  /** Line index of every word. */
  wordLine: number[];
  /** Word index of every character. */
  charWord: number[];
}

/** Lower case, letters and digits only: how accent words are matched. */
export const bare = (w: string): string => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Room inside a mask for ascenders and descenders, taken back with a negative margin.
const PAD = 0.14;

export function splitText(el: HTMLElement, text: string, options: SplitOptions = {}): SplitText {
  const doc = el.ownerDocument;
  const accent = new Set([...(options.accent ?? [])].map(bare));
  const mask = options.mask ?? 'none';
  const f = Math.max(0, options.feather ?? 0);
  // A feathered mask fades over an extra strip below its padding instead of cutting.
  const clip = (display: string, extra = '') => f > 0
    ? `display:${display};overflow:hidden;${extra}padding:${PAD}em 0.06em ${PAD + f}em;margin:-${PAD}em -0.06em -${PAD + f}em;` +
      `mask-image:linear-gradient(to bottom, #000 calc(100% - ${f}em), transparent);-webkit-mask-image:linear-gradient(to bottom, #000 calc(100% - ${f}em), transparent)`
    : `display:${display};overflow:hidden;${extra}padding:${PAD}em 0.06em;margin:-${PAD}em -0.06em`;
  el.textContent = '';

  // 1. Words, laid out once to find where lines break.
  const words: HTMLElement[] = [], chars: HTMLElement[] = [], charWord: number[] = [];
  const hard: number[] = []; // word indices that start a forced line
  text.split('\n').forEach((para, p) => {
    if (p > 0) { el.appendChild(doc.createElement('br')); hard.push(words.length); }
    para.split(/\s+/).filter(Boolean).forEach((w, i) => {
      if (i > 0) el.appendChild(doc.createTextNode(' '));
      const span = doc.createElement('span');
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'pre';
      if (accent.has(bare(w))) span.style.color = 'var(--m-accent)';
      if (options.chars) {
        for (const c of [...w]) {
          const cs = doc.createElement('span');
          cs.textContent = c;
          cs.style.display = 'inline-block';
          span.appendChild(cs);
          chars.push(cs);
          charWord.push(words.length);
        }
      } else span.textContent = w;
      el.appendChild(span);
      words.push(span);
    });
  });
  const wordLine: number[] = [];
  let line = -1, top = -Infinity;
  words.forEach((w, i) => {
    const y = w.offsetTop;
    if (hard.includes(i) || y > top + 1) { line++; top = y; }
    wordLine.push(line);
  });

  // 2. Rebuilt as one block per line, so each line can be masked and moved.
  // A column flex keeps the masks' negative margins from collapsing into each other.
  el.textContent = '';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  const lines: HTMLElement[] = [];
  words.forEach((w, i) => {
    const li = wordLine[i]!;
    let host = lines[li];
    if (!host) {
      // The returned line is what moves; with a mask it sits inside a clipping box.
      host = doc.createElement('span');
      host.style.display = 'block';
      if (mask === 'line') {
        const m = doc.createElement('span');
        m.style.cssText = clip('block');
        m.appendChild(host);
        el.appendChild(m);
      } else el.appendChild(host);
      lines[li] = host;
    } else host.appendChild(doc.createTextNode(' '));
    if (mask === 'word') {
      const m = doc.createElement('span');
      m.style.cssText = clip('inline-block', 'vertical-align:top;');
      m.appendChild(w);
      host.appendChild(m);
    } else host.appendChild(w);
  });
  return { lines, words, chars, wordLine, charWord };
}

/** Words of a text, as `splitText` counts them. Pure, for durations. */
export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;
/** Characters of a text without spaces, as `splitText` counts them. Pure, for durations. */
export const countChars = (text: string): number => [...text.replace(/\s+/g, '')].length;
/** Lines forced by "\n", as `splitText` counts them before wrapping. Pure, for durations. */
export const countHardLines = (text: string): number => Math.max(1, text.split('\n').filter((l) => l.trim()).length);
