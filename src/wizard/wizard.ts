// The wizard. A person answers one question per screen and gets a brief to paste
// into Claude or ChatGPT. The brief is `writeBrief(answers)`: the same function
// the CLI runs, so the page and `motion brief` can never disagree. The answers live
// in the URL fragment, so a link reopens the same brief.
import { checkAnswers, FEELS, FORMATS, writeBrief, type BriefContext } from '../brief/brief.ts';
import type { Answers, Family, Feel, Format, LibraryNarrative } from '../brief/types.ts';
import type { Film } from '../film/types.ts';
import { feelPreview, movePreview, typePreview, type Tone } from './previews.ts';
import { thumb, wake } from './thumb.ts';
import { WIZARD_CSS } from './wizard.css.ts';

type Child = Node | string;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: Child[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
  el.append(...children);
  return el;
};
const name = (slug: string) => {
  const n = slug.split('/').pop() ?? slug;
  return (n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, ' ')).replace(/\bui\b/g, 'UI');
};
const mid = (n: LibraryNarrative) => Math.round((n.duration.min + n.duration.max) / 2);

const FAMILY: Record<Family, string> = { product: 'Product', brand: 'Brand', graphics: 'Motion graphics', social: 'Social' };

interface Step { id: string; label: string; question: string; help?: string; ready?: () => boolean; body: () => Node[] }

export function createWizard(root: HTMLElement, ctx: BriefContext) {
  if (!document.getElementById('mw-css')) document.head.append(h('style', { id: 'mw-css' }, WIZARD_CSS));
  root.className = 'mw';
  root.setAttribute('data-ui-theme', 'graphite');
  root.setAttribute('data-ui-density', 'default');

  const { library, catalog } = ctx;
  const first = library.narratives.find((n) => n.slug === 'narrative/feature-announcement') ?? library.narratives[0]!;
  const defaults = (): Answers => ({
    type: first.slug, style: first.fits[0] ?? library.styles[0]!.slug, feel: 'crisp',
    subject: '', message: '', intent: '', audience: '', content: '', avoid: '',
    duration: mid(first), formats: ['16:9'], moves: [], target: 'agent',
  });
  let a: Answers = defaults();
  /** What the person chose themselves; defaults follow the video type until then. */
  const touched = new Set<string>();
  let index = 0;

  // ---- state in the URL --------------------------------------------------------------
  const encode = (x: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(x))));
  const decode = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s))));
  try {
    const m = /#a=([^&]+)(?:&s=(\d+))?/.exec(location.hash);
    if (m) {
      const saved = decode(m[1]!) as Partial<Answers> & { touched?: string[] };
      a = { ...a, ...saved };
      for (const t of saved.touched ?? []) touched.add(t);
      index = Number(m[2] ?? 0);
    }
  } catch { /* a broken link starts fresh */ }
  const save = () => history.replaceState(null, '', `#a=${encode({ ...a, touched: [...touched] })}&s=${index}`);

  const narrative = () => library.narratives.find((n) => n.slug === a.type) ?? first;
  const style = () => library.styles.find((s) => s.slug === a.style) ?? library.styles[0]!;
  const set = <K extends keyof Answers>(key: K, value: Answers[K], quiet = false) => {
    a = { ...a, [key]: value };
    touched.add(key);
    if (key === 'type') {
      // The look follows the video type: its first fitting style.
      const n = narrative();
      a.style = n.fits[0] ?? a.style;
      if (!touched.has('duration')) a.duration = mid(n);
      const f = style().formats.filter((x): x is Format => x in FORMATS);
      if (!touched.has('formats') && f.length) a.formats = [f[0]!];
    }
    save();
    if (quiet) updateNav(); else render();
  };

  // ---- controls ------------------------------------------------------------------------
  const option = (title: string, detail: string, selected: boolean, onPick: () => void, meta?: string, tag?: string) => {
    const b = h('button', { type: 'button', class: 'mw-option', 'aria-pressed': String(selected) },
      h('b', {}, title, ...(tag ? [h('span', { class: 'mw-tag' }, tag)] : [])), h('small', {}, detail), ...(meta ? [h('span', { class: 'mw-meta' }, meta)] : []));
    b.onclick = onPick;
    return b;
  };
  type Make = (tone: Tone) => Film;
  /** A card with a live thumbnail. Picking one changes the answer without redrawing the step, so thumbnails keep playing. */
  const card = (make: Make | undefined, title: string, detail: string, selected: boolean, onPick: (b: HTMLButtonElement) => void,
    opts: { meta?: string; tag?: string; locked?: boolean } = {}) => {
    const b = h('button', { type: 'button', class: 'mw-card', 'aria-pressed': String(selected), 'aria-disabled': opts.locked ? 'true' : undefined });
    b.append(...(make ? [thumb(make, b)] : []), ...(opts.tag ? [h('span', { class: 'mw-badge' }, opts.tag)] : []), h('span', { class: 'mw-card-text' },
      h('b', {}, title),
      h('small', {}, detail), ...(opts.meta ? [h('span', { class: 'mw-meta' }, opts.meta)] : [])));
    b.onclick = () => { if (!opts.locked) onPick(b); };
    return b;
  };
  /** One choice in a group: press this card, release the others. */
  const pick = (b: HTMLElement) => {
    for (const other of main.querySelectorAll('.mw-card')) other.setAttribute('aria-pressed', String(other === b));
    wake();
  };
  /** The video-type tab on show. Starts on the family of the chosen type. */
  let family: Family = (library.narratives.find((n) => n.slug === a.type) ?? first).family;
  /** A slider with its label and value inside the track. */
  const slider = (label: string, value: number, range: { min: number; max: number; step: number; unit: string }, onInput: (v: number) => void,
    band?: { min: number; max: number; label: string }) => {
    const { min, max, step, unit } = range;
    const input = h('input', { type: 'range', class: 'mw-slider-input', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    input.value = String(value);
    const out = h('output', { class: 'mw-slider-value' });
    const at = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
    const el = h('label', { class: 'mw-slider' },
      ...(band ? [h('span', { class: 'mw-slider-band', style: `left:${at(band.min)}%;width:${at(band.max) - at(band.min)}%`, title: band.label })] : []),
      h('span', { class: 'mw-slider-fill' }), h('span', { class: 'mw-slider-label' }, label), out, input);
    const paint = () => {
      const v = Number(input.value);
      el.style.setProperty('--k', String(at(v) / 100));
      out.textContent = `${v} ${unit}`;
      input.setAttribute('aria-valuetext', `${v} ${unit}`);
    };
    input.oninput = () => { paint(); onInput(Number(input.value)); };
    paint();
    return el;
  };
  const field = (label: string, key: 'subject' | 'message' | 'intent' | 'audience' | 'content' | 'avoid', placeholder: string, opts: { area?: boolean; help?: string } = {}) => {
    const input = opts.area ? h('textarea', { class: 'mw-input', placeholder, rows: '5' }) : h('input', { class: 'mw-input', placeholder, type: 'text' });
    input.value = String(a[key] ?? '');
    input.oninput = () => set(key, input.value, true);
    return h('label', { class: 'mw-field' }, h('span', {}, label), input, ...(opts.help ? [h('small', {}, opts.help)] : []));
  };
  const chip = (label: string, pressed: boolean, onToggle: () => void, opts: { disabled?: boolean; fixed?: boolean; title?: string } = {}) => {
    const b = h('button', { type: 'button', class: 'mw-chip', 'aria-pressed': String(pressed), disabled: opts.disabled || opts.fixed, 'data-fixed': opts.fixed, title: opts.title });
    b.textContent = label;
    b.onclick = onToggle;
    return b;
  };

  // ---- steps ----------------------------------------------------------------------------
  const steps: Step[] = [
    {
      id: 'type', label: 'Video', question: 'What kind of video is it?', help: 'The story it tells. Each one comes with beats and a usual length; the preview plays them in order.',
      body: () => {
        const families = (Object.keys(FAMILY) as Family[]).filter((f) => library.narratives.some((n) => n.family === f));
        const panel = h('div', { class: 'mw-cards', role: 'tabpanel', id: 'mw-type-panel' });
        const tabs = families.map((f) => {
          const b = h('button', { type: 'button', role: 'tab', id: `mw-tab-${f}`, 'aria-controls': 'mw-type-panel' }, FAMILY[f]);
          b.onclick = () => choose(f);
          return b;
        });
        const choose = (f: Family, focus = false) => {
          family = f;
          tabs.forEach((b, i) => { const on = families[i] === f; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
          panel.setAttribute('aria-labelledby', `mw-tab-${f}`);
          panel.replaceChildren(...library.narratives.filter((n) => n.family === f).map((n) =>
            card((t) => typePreview(n, t), name(n.slug), n.summary, a.type === n.slug, (b) => { pick(b); set('type', n.slug, true); },
              { meta: `${n.duration.min}–${n.duration.max} s · ${n.beats.length} beat${n.beats.length === 1 ? '' : 's'}` })));
        };
        const list = h('div', { class: 'mw-tabs', role: 'tablist', 'aria-label': 'Kinds of video' }, ...tabs);
        list.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const i = families.indexOf(family) + (e.key === 'ArrowRight' ? 1 : -1);
          choose(families[(i + families.length) % families.length]!, true);
        });
        choose(families.includes(family) ? family : families[0]!);
        return [list, panel];
      },
    },
    {
      id: 'feel', label: 'Feel', question: 'How should it move?', help: 'The same words at each feel. This sets the timing tokens: durations, staggers and the entrance curve.',
      body: () => [h('div', { class: 'mw-cards mw-cards-3' }, ...(Object.keys(FEELS) as Feel[]).map((f) =>
        card((t) => feelPreview(f, t), FEELS[f].label, FEELS[f].summary, a.feel === f, (b) => { pick(b); set('feel', f, true); })))],
    },
    {
      id: 'message', label: 'Message', question: 'What should it say?', help: 'Short and concrete beats clever. The assistant writes the on-screen words from this.',
      ready: () => !!a.subject.trim() && !!a.message.trim(),
      body: () => [h('div', { class: 'mw-fields' },
        field('What is it about?', 'subject', 'e.g. Live collaboration in Atlas'),
        field('The one thing to remember', 'message', 'e.g. Edit the same file together, without conflicts'),
        field('Afterwards the viewer should…', 'intent', 'e.g. try it in today’s update'),
        field('Who is watching?', 'audience', 'e.g. product designers who already use Atlas'))],
    },
    {
      id: 'content', label: 'Content', question: 'Anything it must show?', help: 'Optional. Numbers, names, quotes, features. One per line.',
      body: () => [h('div', { class: 'mw-fields' },
        field('Content', 'content', '3× faster reviews\n“Finally, no more merge hell”\nComments · Cursors · History', { area: true }),
        field('Avoid', 'avoid', 'e.g. stock phrases, emoji, the old logo'))],
    },
    {
      id: 'moves', label: 'Moves', question: 'Any moves you want in it?', help: 'Every preview is drawn by the runtime itself, so what you see is what the film can do.',
      body: () => {
        const s = style(), n = narrative();
        const suggested = new Set([...n.beats.flatMap((b) => b.primitives), ...s.uses]);
        const drawable = [...catalog.primitives, ...catalog.transitions].filter((p) => !p.slug.startsWith('el/')).sort((x, y) => x.slug.localeCompare(y.slug));
        const drawn = new Set(drawable.map((p) => p.slug));
        const missing = [...suggested].filter((m) => !drawn.has(m)).sort();
        const picked = new Set(a.moves ?? []);
        return [
          h('div', { class: 'mw-group' }, h('h2', {}, 'Drawable now'), h('p', {}, 'Pick any to add them. The story and the look already include the marked ones.'),
            h('div', { class: 'mw-cards mw-cards-3 mw-cards-small' }, ...drawable.map((p) => {
              const m = p.slug, make = (t: Tone) => movePreview(m, t)!;
              if (s.avoids.includes(m)) return card(make, name(m), p.summary, false, () => {}, { locked: true, tag: 'The look avoids it' });
              if (suggested.has(m)) return card(make, name(m), p.summary, true, () => {}, { locked: true, tag: 'In the story' });
              return card(make, name(m), p.summary, picked.has(m), (b) => {
                picked.has(m) ? picked.delete(m) : picked.add(m);
                b.setAttribute('aria-pressed', String(picked.has(m)));
                wake();
                set('moves', [...picked].sort(), true);
              });
            }))),
          ...(missing.length ? [h('div', { class: 'mw-group' }, h('h2', {}, 'In the story, not drawable yet'),
            h('p', {}, 'The brief asks the assistant to build these from drawable moves, or to say what it would need.'),
            h('div', { class: 'mw-chips' }, ...missing.map((m) => chip(name(m), false, () => {}, { fixed: true }))))] : []),
        ];
      },
    },
    {
      id: 'length', label: 'Format', question: 'How long, and where will it play?', help: 'Drag the bar or use the arrow keys. The shaded band is the usual length for this kind of video.',
      ready: () => a.formats.length > 0,
      body: () => {
        const n = narrative();
        const formats = (Object.keys(FORMATS) as Format[]).map((f) => {
          const b = chip(`${f} ${FORMATS[f].label}`, a.formats.includes(f), () =>
            set('formats', a.formats.includes(f) ? a.formats.filter((x) => x !== f) : [...a.formats, f]));
          const [w, hgt] = f.split(':').map(Number) as [number, number];
          b.prepend(h('i', { class: 'mw-ratio', style: `aspect-ratio:${w} / ${hgt};${w >= hgt ? 'width:18px' : 'height:18px'}` }));
          return b;
        });
        const color = h('input', { type: 'color', 'aria-label': 'Accent colour' });
        color.value = a.accent ?? '#2440f0';
        color.oninput = () => set('accent', color.value, true);
        const clear = chip('No accent', !a.accent, () => { a = { ...a }; delete a.accent; touched.add('accent'); save(); render(); });
        return [
          h('div', { class: 'mw-group' },
            slider('Length', a.duration, { min: 5, max: 120, step: 1, unit: 's' }, (v) => set('duration', v, true),
              { ...n.duration, label: `${name(n.slug)} usually runs ${n.duration.min}–${n.duration.max} s` }),
            h('p', { class: 'mw-scale' }, h('i', { class: 'mw-band-key' }), `${name(n.slug)} usually runs ${n.duration.min}–${n.duration.max} s`)),
          h('div', { class: 'mw-group' }, h('h2', {}, 'Formats'), h('p', {}, 'The first one is made first; the others are re-laid, not cropped.'), h('div', { class: 'mw-chips' }, ...formats)),
          h('div', { class: 'mw-group' }, h('h2', {}, 'Brand'),
            h('div', { class: 'mw-color' }, color, clear,
              chip('Light', a.scheme !== 'dark', () => set('scheme', 'light')), chip('Dark', a.scheme === 'dark', () => set('scheme', 'dark')))),
        ];
      },
    },
    {
      id: 'target', label: 'Assistant', question: 'Where will you paste it?', help: 'The brief says what the assistant can do there.',
      body: () => [h('div', { class: 'mw-options' },
        option('Claude Code, in this repository', 'It writes the film, validates it, looks at stills and opens the studio for you.', a.target === 'agent', () => set('target', 'agent')),
        option('Claude or ChatGPT chat', 'It returns the film as JSON. You save it and preview it here.', a.target === 'chat', () => set('target', 'chat')))],
    },
    {
      id: 'brief', label: 'Brief', question: 'Your brief', help: 'Copy it into the assistant. Change any answer and the brief follows.',
      body: () => {
        const problems = checkAnswers(a, ctx);
        if (problems.length) return [h('p', { class: 'mw-help' }, problems.join(' '))];
        const text = (briefText = writeBrief(a, ctx));
        const file = (a.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'motion') + '.brief';
        const download = h('button', { type: 'button', class: 'mw-secondary' }, 'Download .md');
        download.onclick = () => saveFile(`${file}.md`, text, 'text/markdown');
        const answers = h('button', { type: 'button', class: 'mw-secondary' }, 'Save answers');
        answers.onclick = () => saveFile(`${file}.json`, `${JSON.stringify(a, null, 2)}\n`, 'application/json');
        const jump = (label: string, id: string) => { const b = h('button', { type: 'button' }, label); b.onclick = () => go(steps.findIndex((s) => s.id === id)); return h('li', {}, b); };
        return [
          h('ul', { class: 'mw-summary', 'aria-label': 'Your answers' },
            jump(name(a.type), 'type'), jump(FEELS[a.feel].label, 'feel'),
            jump(`${a.duration} s · ${a.formats.join(', ')}`, 'length'), jump(a.target === 'agent' ? 'Claude Code' : 'Chat', 'target')),
          h('pre', { class: 'mw-brief', tabindex: '0', 'aria-label': 'Brief' }, text),
          h('div', { class: 'mw-actions' }, download, answers),
          h('p', { class: 'mw-note' }, 'Saved answers make the same brief from the command line: ', h('code', {}, `node bin/motion.mjs brief ${file}.json`)),
        ];
      },
    },
  ];

  function saveFile(fileName: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = h('a', { href: url, download: fileName });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- frame ---------------------------------------------------------------------------
  const restart = h('button', { type: 'button', class: 'mw-pill' }, 'Start over');
  restart.onclick = () => { a = defaults(); touched.clear(); go(0); };
  const main = h('main', { class: 'mw-main' });
  const progress = h('div', { class: 'mw-progress', 'aria-hidden': 'true' });
  const back = h('button', { type: 'button', class: 'mw-back' }, 'Back');
  const next = h('button', { type: 'button', class: 'mw-next' }, 'Next');
  const status = h('p', { class: 'mw-live', role: 'status' });
  /** The brief on the last step. Copying it is that step's primary action, so it sits where Next was. */
  let briefText = '';
  back.onclick = () => go(index - 1);
  next.onclick = async () => {
    if (index < steps.length - 1) return go(index + 1);
    let copied = false;
    try { await navigator.clipboard.writeText(briefText); copied = true; } catch {
      // Some embedded browsers block the async clipboard; selecting the text still works there.
      const pre = main.querySelector('.mw-brief');
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        copied = document.execCommand('copy');
      }
    }
    next.textContent = copied ? 'Copied' : 'Selected: copy it';
    status.textContent = copied ? 'Brief copied' : 'Copying is blocked here. The brief is selected; press Cmd+C or Ctrl+C.';
    setTimeout(() => { if (index === steps.length - 1) next.textContent = 'Copy brief'; }, 1800);
  };
  root.replaceChildren(
    h('header', { class: 'mw-top' }, h('div', { class: 'mw-mark' }, 'Motion ', h('span', {}, 'brief')), restart),
    main,
    h('footer', { class: 'mw-foot' }, progress, h('nav', { class: 'mw-nav', 'aria-label': 'Steps' }, back, next), status),
  );
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON') return;
    if (!next.disabled && index < steps.length - 1) { e.preventDefault(); go(index + 1); }
  });

  function go(i: number) {
    index = Math.max(0, Math.min(steps.length - 1, i));
    save();
    render(true);
  }

  function updateNav() {
    const step = steps[index]!;
    progress.replaceChildren(...steps.map((_, i) => h('i', { 'data-done': i <= index })));
    back.hidden = index === 0;
    const last = index === steps.length - 1;
    next.disabled = last ? !briefText : step.ready ? !step.ready() : false;
    next.textContent = last ? 'Copy brief' : index === steps.length - 2 ? 'Write the brief' : 'Next';
  }

  function render(moved = false) {
    const step = steps[index]!;
    const focused = document.activeElement instanceof HTMLElement && main.contains(document.activeElement) ? document.activeElement.getAttribute('aria-pressed') !== null : false;
    const heading = h('h1', { class: 'mw-q', tabindex: '-1' }, step.question);
    briefText = '';
    main.replaceChildren(
      h('p', { class: 'mw-step' }, `Step ${index + 1} of ${steps.length} · ${step.label}`), heading,
      ...(step.help ? [h('p', { class: 'mw-help' }, step.help)] : []), ...step.body(),
    );
    updateNav();
    if (moved) heading.focus({ preventScroll: false });
    else if (focused) main.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  }

  render();
  return { get answers() { return a; }, go };
}
