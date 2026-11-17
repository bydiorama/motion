// The studio: where a person directs a film. The parameter panel and the timeline
// dock are DialKit; every dial in them is generated from the film and the catalog
// (see dials.ts). Nothing here edits the film file: dials and dragged clips write
// overrides, and pinned notes are stored beside them, in the tune file the agent
// reads back.
//
// Layout, as one screen with no page scroll:
//   scenes       every scene with a still and its intent; click to go there
//   stage        the film's name, numbers and save state over it; the film at the
//                largest size that fits, with the transport under it
//   inspector    Tune (the DialKit panel), Notes, Issues
//   dock         the DialKit timeline: scene clips to stretch and slide
import { createDialKit, createDialRoot, createDialTimeline, createDialTimelineRoot, DialStore } from 'dialkit/vanilla';
import dialCss from 'dialkit/vanilla/styles.css';
import { FilmError, mount, type Mounted } from '../dom/mount.ts';
import { createSoundtrack, type Soundtrack } from '../dom/soundtrack.ts';
import { STAGE_CSS } from '../dom/stage.css.ts';
import { fade } from './fade.ts';
import { applyTune } from '../film/tune.ts';
import type { Film, Issue, Note, ResolvedScene, Timeline, Tune } from '../film/types.ts';
import { buildPanel, overridesFrom, type Panel } from './dials.ts';
import { STUDIO_CSS } from './studio.css.ts';

export interface StudioOptions {
  root: HTMLElement;
  film: Film;
  tune: Tune;
  /** Persists the tune. Left out, the studio still works but nothing is kept. */
  save?: (tune: Tune) => Promise<void>;
  slots?: Record<string, (el: HTMLElement) => void>;
}

type Clip = { at: number; duration: number };
type ClipConfig = { duration: number } & Record<string, Clip | number>;
type Kit = ReturnType<typeof createDialKit>;
type Dock = ReturnType<typeof createDialTimeline>;
type Tab = 'tune' | 'notes' | 'issues';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
};
const svg = (d: string) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = d;
  return s;
};
const ICON = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/>',
  prev: '<path d="M18 6.5v11a.8.8 0 0 1-1.25.66L9 12.66a.8.8 0 0 1 0-1.32l7.75-5.5A.8.8 0 0 1 18 6.5Z" fill="currentColor"/><rect x="6" y="6" width="2.2" height="12" rx="1" fill="currentColor"/>',
  next: '<path d="M6 6.5v11a.8.8 0 0 0 1.25.66L15 12.66a.8.8 0 0 0 0-1.32L7.25 5.84A.8.8 0 0 0 6 6.5Z" fill="currentColor"/><rect x="15.8" y="6" width="2.2" height="12" rx="1" fill="currentColor"/>',
};
/** The stage's colour and font variables. A thumbnail freezes them, because it sits inside the studio's theme scope. */
const STAGE_VARS = [...new Set(STAGE_CSS.match(/--m-[a-z-]+(?=:)/g) ?? [])];
const fmt = (t: number) => `${t.toFixed(2)} s`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Timeline keys are scene ids; `duration` is the one name the dock keeps for itself. */
const clipKey = (id: string) => (id === 'duration' ? 'duration scene' : id);
const DOCK_ID = 'motion-timeline';

export function createStudio(options: StudioOptions) {
  let film = options.film;
  const tune: Tune = { set: { ...(options.tune.set ?? {}) }, notes: [...(options.tune.notes ?? [])] };
  let mounted: Mounted | undefined, kit: Kit | undefined, dock: Dock | undefined;
  let tuned: Panel | undefined, untuned: Panel | undefined;
  let clips: ClipConfig | undefined;
  let time = 0, saveTimer = 0, drawQueued = false, dragging = false, clipEditPending = false, syncing = false;
  let issueCount = 0, current = -1, tab: Tab = 'tune';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const [id, css] of [['m-dialkit-css', dialCss], ['m-studio-css', STUDIO_CSS]] as const) {
    if (!document.getElementById(id)) document.head.appendChild(h('style', { id }, css));
  }
  const root = options.root;
  root.classList.add('ms');

  // The chrome wears bydiorama/ui's Graphite theme; the stage keeps the film's own look.
  const chrome = (tag: 'header' | 'aside' | 'div' | 'footer', cls: string, ...children: Node[]) =>
    h(tag, { class: `${cls} ms-chrome`, 'data-ui-theme': 'graphite', 'data-ui-density': 'default' }, ...children);

  // ---- the film's header, over the stage -----------------------------------------------
  // No page-wide bar: each column heads itself, and the three heads share one line.
  const title = h('h1'), meta = h('p', { class: 'ms-meta' }), status = h('p', { class: 'ms-status', role: 'status' });
  const head = chrome('header', 'ms-head', h('div', { class: 'ms-film' }, title, meta), status);

  // ---- scenes ----------------------------------------------------------------------
  const sceneList = h('ol', { class: 'ms-scenes' }), sceneCount = h('span', { class: 'ms-rail-count' });
  const rail = chrome('aside', 'ms-rail', h('div', { class: 'ms-rail-head' }, h('h2', {}, 'Scenes'), sceneCount), h('div', { class: 'ms-scroll' }, sceneList));
  rail.setAttribute('aria-label', 'Scenes');

  // ---- stage and transport -----------------------------------------------------------
  const host = h('div', { class: 'ms-host' });
  const frame = h('div', { class: 'ms-frame' }, host);
  const btn = (cls: string, label: string, icon: string) => { const b = h('button', { type: 'button', class: cls, 'aria-label': label, title: label }); b.append(svg(icon)); return b; };
  const prev = btn('ms-skip', 'Previous scene  [', ICON.prev), next = btn('ms-skip', 'Next scene  ]', ICON.next);
  const play = btn('ms-play', 'Play  Space', ICON.play);
  const clock = h('p', { class: 'ms-clock' }), where = h('p', { class: 'ms-where' });
  const transport = chrome('div', 'ms-transport', clock, h('div', { class: 'ms-controls' }, prev, play, next), where);
  const banner = h('div', { class: 'ms-banner', role: 'alert', hidden: '' });
  const canvas = h('main', { class: 'ms-canvas' }, head, h('div', { class: 'ms-stagewrap' }, frame, banner), transport);

  // ---- inspector -----------------------------------------------------------------------
  const panelEl = h('div', { class: 'ms-panel' }), notes = h('section', { class: 'ms-notes' }), problems = h('section', { class: 'ms-problems' });
  const panes: Record<Tab, HTMLElement> = { tune: panelEl, notes, issues: problems };
  const tabs: Record<Tab, HTMLButtonElement> = {
    tune: h('button', { type: 'button', role: 'tab' }, 'Tune'),
    notes: h('button', { type: 'button', role: 'tab' }),
    issues: h('button', { type: 'button', role: 'tab' }),
  };
  for (const [k, b] of Object.entries(tabs) as [Tab, HTMLButtonElement][]) {
    b.id = `ms-tab-${k}`;
    b.setAttribute('aria-controls', `ms-pane-${k}`);
    panes[k].id = `ms-pane-${k}`;
    panes[k].setAttribute('role', 'tabpanel');
    panes[k].setAttribute('aria-labelledby', b.id);
    b.onclick = () => show(k);
  }
  const tablist = h('div', { class: 'ms-tabs', role: 'tablist', 'aria-label': 'Inspector' }, tabs.tune, tabs.notes, tabs.issues);
  tablist.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const order = (Object.keys(tabs) as Tab[]).filter((k) => !tabs[k].hidden);
    const i = order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
    show(order[(i + order.length) % order.length]!, true);
  });
  const inspector = chrome('aside', 'ms-inspector', tablist, h('div', { class: 'ms-scroll' }, panelEl, notes, problems));
  inspector.setAttribute('aria-label', 'Inspector');

  function show(next: Tab, focus = false) {
    tab = next;
    for (const k of Object.keys(tabs) as Tab[]) {
      tabs[k].setAttribute('aria-selected', String(k === tab));
      tabs[k].tabIndex = k === tab ? 0 : -1;
      panes[k].hidden = k !== tab;
    }
    if (focus) tabs[tab].focus();
  }
  const badge = (label: string, n: number) => [label, ...(n ? [h('span', { class: 'ms-count' }, String(n))] : [])];
  function labelTabs() {
    const open = (tune.notes ?? []).filter((n) => n.status !== 'done').length;
    tabs.notes.replaceChildren(...badge('Notes', open));
    tabs.issues.replaceChildren(...badge('Issues', issueCount));
    tabs.issues.hidden = issueCount === 0;
    if (tabs.issues.hidden && tab === 'issues') show('tune');
  }

  // ---- dock ------------------------------------------------------------------------------
  const dockEl = h('div', { class: 'ms-dock-scroll' });
  const dockFrame = chrome('footer', 'ms-dock', dockEl);

  root.replaceChildren(h('div', { class: 'ms-body' }, rail, canvas, inspector), dockFrame);

  // ---- edge fades (bydiorama/ui's Fade): every scrolling region dissolves into its own ground ----
  for (const side of ['top', 'bottom'] as const) {
    fade(sceneList, { side, ground: 'base', size: 'sm' });
    // DialKit pins the panel's title and versions inside the scroller: the top fade hangs under them.
    fade(panelEl, { side, ground: 'base', under: '.dialkit-panel-header' });
    fade(notes, { side, ground: 'base', size: 'sm' });
    fade(problems, { side, ground: 'base', size: 'sm' });
    fade(dockEl, { side, ground: 'base', size: 'sm' });
  }
  createDialRoot({ target: panelEl, mode: 'inline', theme: 'system', versions: 'menu' });
  createDialTimelineRoot({ target: dockEl, theme: 'system', defaultOpen: true });
  if (!options.save) status.textContent = 'Read only: changes are not kept';
  show('tune');

  // ---- the film on the stage ----------------------------------------------------------
  function remount(): Timeline | undefined {
    mounted?.destroy();
    mounted = undefined;
    let issues: Issue[] = [];
    try {
      mounted = mount(host, film, { tune, ...(options.slots ? { slots: options.slots } : {}) });
      issues = mounted.issues;
    } catch (e) {
      if (e instanceof FilmError) issues = e.issues; else throw e;
    }
    showProblems(issues, mounted?.orphans ?? []);
    title.textContent = film.title ?? 'Untitled film';
    if (!mounted) {
      meta.textContent = 'Cannot be drawn until the errors are fixed';
      banner.hidden = false;
      banner.replaceChildren(h('b', {}, 'The film has errors.'), ' The agent fixes them in the film; they are listed under Issues.');
      show('issues');
      return undefined;
    }
    banner.hidden = true;
    const tl = mounted.timeline;
    meta.replaceChildren(...[fmt(tl.duration), `${tl.fps} fps`, `${tl.size[0]}×${tl.size[1]}`].map((x) => h('span', {}, x)));
    frame.style.setProperty('--ar', String(tl.size[0] / tl.size[1]));
    sceneList.style.setProperty('--ar', String(tl.size[0] / tl.size[1]));
    drawScenes(tl);
    time = Math.min(time, tl.duration);
    draw();
    queueThumbs();
    return tl;
  }

  const sceneAt = (t: number): number => {
    if (!mounted) return -1;
    // During a hand-over two scenes are on screen; the arriving one is current.
    const s = mounted.timeline.scenes;
    for (let i = s.length - 1; i >= 0; i--) if (t >= s[i]!.start) return i;
    return 0;
  };

  function draw() {
    if (!mounted) return;
    mounted.seek(time);
    const total = mounted.duration;
    clock.replaceChildren(h('b', {}, time.toFixed(2)), ` / ${total.toFixed(2)} s`);
    const i = sceneAt(time);
    const scene = mounted.timeline.scenes[i];
    where.textContent = `${scene ? `${i + 1}/${mounted.timeline.scenes.length} ${scene.id}` : ''} · frame ${Math.round(time * mounted.fps)}`;
    if (i !== current) {
      current = i;
      sceneList.querySelectorAll('button').forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      sceneList.children[i]?.scrollIntoView({ block: 'nearest' });
    }
    markClip(i);
    pin.textContent = `Pin at ${time.toFixed(2)} s`;
  }

  function drawScenes(tl: Timeline) {
    current = -1;
    sceneCount.textContent = String(tl.scenes.length);
    sceneList.replaceChildren(...tl.scenes.map((s: ResolvedScene, i) => {
      const intent = s.source.intent;
      const b = h('button', { type: 'button', ...(intent ? { title: intent } : {}) },
        h('span', { class: 'ms-thumb', 'aria-hidden': 'true' }),
        h('span', { class: 'ms-scene-text' },
          h('span', { class: 'ms-scene-head' }, h('b', {}, s.id), h('span', { class: 'ms-scene-len' }, fmt(s.length))),
          ...(intent ? [h('span', { class: 'ms-scene-intent' }, intent)] : [])));
      b.onclick = () => goTo(s.start);
      return h('li', {}, b);
    }));
  }

  /**
   * A still of every scene for the list. The stage is seeked to a settled moment of
   * each scene and copied; the playhead is put back in the same task, so nothing
   * flickers. Waits for fonts and images, and for dials to stop moving.
   */
  let thumbTimer = 0;
  function queueThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = window.setTimeout(() => {
      const m = mounted;
      void m?.ready.then(() => { if (m === mounted) drawThumbs(m); });
    }, 300);
  }
  function drawThumbs(m: Mounted) {
    const [W] = m.timeline.size, cs = getComputedStyle(m.stage);
    const vars = STAGE_VARS.map((v) => [v, cs.getPropertyValue(v)] as const).filter(([, v]) => v);
    const sections = [...m.stage.children] as HTMLElement[];
    m.timeline.scenes.forEach((s, i) => {
      const box = sceneList.children[i]?.querySelector<HTMLElement>('.ms-thumb');
      if (!box) return;
      // Late enough that the scene has built, early enough that the next one has not arrived.
      m.seek(s.start + Math.max(0, Math.min(s.length * 0.7, s.length - 0.1)));
      const still = m.stage.cloneNode(true) as HTMLElement;
      const copies = [...still.children];
      sections.forEach((el, k) => { if (el.classList.contains('m-scene') && getComputedStyle(el).visibility !== 'visible') copies[k]?.remove(); });
      for (const [k, v] of vars) still.style.setProperty(k, v);
      still.style.transform = `scale(${(box.clientWidth || 180) / W})`;
      still.removeAttribute('role');
      still.removeAttribute('aria-label');
      still.inert = true;
      box.querySelector('.m-stage')?.remove();
      box.prepend(still);
    });
    m.seek(time);
  }

  /** The dock's clip for the scene under the playhead is drawn solid. DialKit redraws its rows (on resize, too), so this is checked on every frame and every redraw. */
  new MutationObserver(() => markClip(current)).observe(dockEl, { childList: true, subtree: true });
  function markClip(i: number) {
    const clipsEl = dockEl.querySelectorAll('.dialkit-timeline-row:not(.dialkit-timeline-ruler-row) .dialkit-timeline-clip');
    if (clipsEl[i]?.hasAttribute('data-current')) return;
    clipsEl.forEach((c, k) => c.toggleAttribute('data-current', k === i));
  }

  function showProblems(issues: Issue[], orphans: string[]) {
    const rows = [
      ...issues.map((i) => h('li', { 'data-level': i.level }, h('span', { class: 'ms-level' }, i.level === 'error' ? 'Error' : 'Warning'),
        h('code', {}, i.path || 'film'), h('p', {}, `${i.message}${i.hint ? ` ${i.hint}` : ''}`))),
      ...orphans.map((p) => {
        const drop = h('button', { type: 'button', class: 'ms-secondary' }, 'Remove override');
        drop.onclick = () => { delete tune.set![p]; rebuild(); persist(); };
        return h('li', { 'data-level': 'warning' }, h('span', { class: 'ms-level' }, 'Orphan'), h('code', {}, p),
          h('p', {}, 'This override points at something the film no longer has.'), drop);
      }),
    ];
    issueCount = rows.length;
    problems.replaceChildren(...(rows.length ? [h('ul', {}, ...rows)] : [h('p', { class: 'ms-empty' }, 'No issues.')]));
    labelTabs();
  }

  // ---- soundtrack: follows the playhead; rebuilt when the film's audio changes -------------
  let sound: { key: string; track: Soundtrack } | undefined;
  function soundtrack(): Soundtrack | undefined {
    const a = mounted?.timeline.audio, key = a ? JSON.stringify(a) : '';
    if (sound?.key === key) return sound.track;
    sound?.track.dispose();
    sound = a ? { key, track: createSoundtrack(a) } : undefined;
    return sound?.track;
  }

  // ---- transport --------------------------------------------------------------------------
  function goTo(t: number) { dock?.pause(); dock?.seek(t); }
  function toggle() {
    if (!dock || !mounted) return;
    const v = dock.values;
    if (v.playing) dock.pause();
    else if (time >= mounted.duration - 1 / mounted.fps) dock.replay();
    else dock.play();
  }
  function step(dir: 1 | -1) {
    if (!mounted) return;
    const s = mounted.timeline.scenes, i = sceneAt(time);
    if (dir < 0) {
      // Like a music player: back goes to the start of this scene, twice goes to the one before.
      const start = s[i]?.start ?? 0;
      goTo(time - start > 0.25 || i === 0 ? start : s[i - 1]!.start);
    } else if (s[i + 1]) goTo(s[i + 1]!.start);
  }
  play.onclick = toggle;
  prev.onclick = () => step(-1);
  next.onclick = () => step(1);
  function showPlaying(playing: boolean) {
    play.replaceChildren(svg(playing ? ICON.pause : ICON.play));
    const label = playing ? 'Pause  Space' : 'Play  Space';
    play.setAttribute('aria-label', label);
    play.title = label;
    play.dataset.playing = String(playing);
  }

  // ---- timeline dock: draggable scene clips ---------------------------------------------
  const clipConfig = (tl: Timeline): ClipConfig => {
    const config: ClipConfig = { duration: tl.duration };
    for (const s of tl.scenes) config[clipKey(s.id)] = { at: s.start, duration: s.length };
    return config;
  };

  function syncDock(tl: Timeline) {
    const next = clipConfig(tl);
    if (dock && same(next, clips)) return;
    clips = next;
    if (dock) { pushTimes(tl, next); return; }
    dock = createDialTimeline('Timeline', next, { id: DOCK_ID, loop: film.loop !== false, autoplay: !reduced });
    pushTimes(tl);
    if (reduced) dock.seek(film.poster ?? tl.duration);
    let playing: boolean | undefined;
    dock.subscribe((v) => {
      time = v.time;
      if (v.playing !== playing) showPlaying((playing = v.playing));
      draw();
      soundtrack()?.sync(v.time, v.playing);
      if (syncing || !clipsMoved(v as unknown as Record<string, Clip>)) return;
      // A clip is being dragged: wait for the pointer to lift, then retime the film once.
      if (dragging) clipEditPending = true; else retime(v as unknown as Record<string, Clip>);
    });
  }

  /**
   * The dock keeps the values a person dragged (and remembers them across visits);
   * its config only sets defaults. So the film's real times are written back into
   * its store, and the notifications that causes are ignored.
   */
  function pushTimes(tl: Timeline, config?: ClipConfig) {
    syncing = true;
    try {
      if (config) dock?.updateConfig(config);
      const updates: Record<string, number> = {};
      for (const s of tl.scenes) { updates[`${clipKey(s.id)}.at`] = s.start; updates[`${clipKey(s.id)}.duration`] = s.length; }
      DialStore.updateValues(DOCK_ID, updates);
    } finally { syncing = false; }
  }

  const clipsMoved = (v: Record<string, Clip>): boolean => !!mounted && !!clips && mounted.timeline.scenes.some((s) => {
    const now = v[clipKey(s.id)], was = clips![clipKey(s.id)] as Clip, eps = 0.5 / mounted!.fps;
    return !!now && (Math.abs(now.at - was.at) > eps || Math.abs(now.duration - was.duration) > eps);
  });

  /**
   * Scenes run in order, so a clip cannot sit anywhere. Only the clips the person
   * touched count; everything after them ripples:
   * - stretching a clip's end sets that scene's length;
   * - sliding a clip changes the length of the scene before it, so the slid scene
   *   keeps its own length;
   * - trimming a clip's start does both, so its end stays where it was.
   */
  function retime(v: Record<string, Clip>) {
    if (!mounted || !clips) return;
    const scenes = mounted.timeline.scenes, fps = mounted.fps, eps = 0.5 / fps;
    const snap = (n: number) => Math.max(1 / fps, Math.round(n * fps) / fps);
    const set = (tune.set ??= {});
    scenes.forEach((s, i) => {
      const now = v[clipKey(s.id)], was = clips![clipKey(s.id)] as Clip | undefined;
      if (!now || !was) return;
      const moved = now.at - was.at, stretched = now.duration - was.duration;
      if (Math.abs(stretched) > eps) set[`scenes.${s.id}.length`] = snap(now.duration);
      const before = scenes[i - 1];
      if (Math.abs(moved) > eps && before) {
        const prev = clips![clipKey(before.id)] as Clip;
        set[`scenes.${before.id}.length`] = snap(prev.duration + moved);
      }
    });
    clipEditPending = false;
    rebuild();
    persist();
  }

  dockEl.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => {
    dragging = false;
    if (clipEditPending && dock) retime(dock.values as unknown as Record<string, Clip>);
  });

  // ---- parameter panel ------------------------------------------------------------------
  function rebuild() {
    untuned = buildPanel(film);
    tuned = buildPanel(applyTune(film, tune).film);
    kit?.destroy();
    kit = undefined;
    const tl = remount();
    if (tl) syncDock(tl);
    drawNotes();
    if (!tuned) return;
    kit = createDialKit(film.title ?? 'Film', tuned.config as Parameters<typeof createDialKit>[1], {
      id: 'motion-film',
      onAction: (action) => { if (action.includes('reset')) { tune.set = {}; rebuild(); persist(); } },
    });
    kit.subscribe((values) => {
      if (!tuned || !untuned) return;
      const next = overridesFrom(values, tuned, untuned, tune.set ?? {});
      if (same(next, tune.set)) return;
      tune.set = next;
      persist();
      // A dragged dial fires many times a frame; redraw once per frame.
      if (drawQueued) return;
      drawQueued = true;
      requestAnimationFrame(() => { drawQueued = false; const tl2 = remount(); if (tl2) syncDock(tl2); });
    }, false);
  }

  // ---- notes ----------------------------------------------------------------------------
  const input = h('textarea', { rows: '3', placeholder: 'What should change at this moment?', 'aria-label': 'New note' });
  const pin = h('button', { type: 'button', class: 'ms-primary' }, 'Pin at 0.00 s');
  pin.onclick = () => {
    const text = input.value.trim();
    if (!text || !mounted) { input.focus(); return; }
    const t = Number(time.toFixed(3));
    const scene = mounted.timeline.scenes[sceneAt(t)];
    const note: Note = { id: `n${Date.now().toString(36)}`, t, text, status: 'open', ...(scene ? { scene: scene.id } : {}) };
    (tune.notes ??= []).push(note);
    tune.notes.sort((a, b) => a.t - b.t);
    input.value = '';
    drawNotes();
    persist();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pin.click(); } });
  const composer = h('div', { class: 'ms-composer' }, input, h('div', { class: 'ms-composer-foot' }, h('small', {}, 'The agent reads these. ⌘↵ pins.'), pin));
  const noteList = h('ul', { class: 'ms-note-list' });
  notes.append(composer, noteList);

  function drawNotes() {
    const items = (tune.notes ?? []).map((n) => {
      const jump = h('button', { type: 'button', class: 'ms-jump' }, fmt(n.t));
      jump.onclick = () => goTo(n.t);
      const done = h('input', { type: 'checkbox', 'aria-label': 'Done' });
      done.checked = n.status === 'done';
      done.onchange = () => { n.status = done.checked ? 'done' : 'open'; drawNotes(); persist(); };
      const del = h('button', { type: 'button', class: 'ms-del', 'aria-label': 'Delete note', title: 'Delete note' }, '×');
      del.onclick = () => { tune.notes = (tune.notes ?? []).filter((x) => x !== n); drawNotes(); persist(); };
      return h('li', { 'data-status': n.status }, done,
        h('div', {}, h('div', { class: 'ms-note-meta' }, jump, h('span', {}, [n.scene, n.layer].filter(Boolean).join(' › '))),
          h('p', {}, n.text), ...(n.reply ? [h('p', { class: 'ms-reply' }, n.reply)] : [])), del);
    });
    noteList.replaceChildren(...(items.length ? items : [h('li', { class: 'ms-empty' }, 'Pause on a moment and say what should change.')]));
    labelTabs();
  }

  // ---- saving ---------------------------------------------------------------------------
  function persist() {
    if (!options.save) return;
    status.textContent = 'Saving…';
    status.dataset.state = 'saving';
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      options.save!(tune).then(
        () => {
          const n = Object.keys(tune.set ?? {}).length;
          status.textContent = n ? `Saved · ${n} override${n === 1 ? '' : 's'}` : 'Saved';
          status.dataset.state = 'saved';
        },
        () => { status.textContent = 'Not saved: is the preview server running?'; status.dataset.state = 'error'; },
      );
    }, 250);
  }

  document.addEventListener('keydown', (e) => {
    if (!dock || !mounted || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || target.closest('.dialkit-root')) return;
    if (e.key === ' ' && target.tagName !== 'BUTTON') { e.preventDefault(); toggle(); return; }
    if (e.key === '[') { step(-1); return; }
    if (e.key === ']') { step(1); return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (target.getAttribute('role') === 'tab') return;
    e.preventDefault();
    const by = e.shiftKey ? 1 : 1 / mounted.fps;
    goTo(Math.min(mounted.duration, Math.max(0, time + (e.key === 'ArrowRight' ? by : -by))));
  });

  showPlaying(false);
  rebuild();
  return {
    /** Replace the film, e.g. after the agent rewrote the file. Tuning and the playhead are kept. */
    setFilm(next: Film) { film = next; rebuild(); status.textContent = 'Film reloaded'; },
    get tune() { return tune; },
    /** The DialKit panel and timeline controllers, for scripts and the console. */
    get kit() { return kit; },
    get dock() { return dock; },
  };
}
