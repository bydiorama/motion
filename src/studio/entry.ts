// The page every film is shown in. Three modes, one bundle:
//   #render             the film alone at its own pixel size (for the renderer)
//   with a server       the studio: dials and notes are saved to the tune file
//   as a built file     a read-only player
import { startPage } from '../dom/page.ts';
import type { Film, Tune } from '../film/types.ts';
import type { FrameSequence } from '../primitives/types.ts';
import { createStudio } from './studio.ts';

declare global {
  interface Window {
    /** A host page sets this before the bundle runs to fill `el/slot` layers. */
    motionSlots?: Record<string, (el: HTMLElement) => void>;
    /** The running studio, for scripts and the console. */
    motionStudio?: ReturnType<typeof createStudio>;
  }
}

async function main() {
  const inline = document.getElementById('film-data');
  const live = !inline;
  let film: Film, tune: Tune;
  if (inline) ({ film, tune } = JSON.parse(inline.textContent ?? '{}') as { film: Film; tune: Tune });
  else [film, tune] = await Promise.all([fetch('/api/film').then((r) => r.json()), fetch('/api/tune').then((r) => r.json())]) as [Film, Tune];
  const root = document.getElementById('app')!;
  const slots = window.motionSlots;

  if (location.hash === '#render') {
    // The CLI pulls footage frames before it opens the page; a built file has none.
    const frames = live ? await fetch('/api/frames').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Record<string, FrameSequence> : {};
    await startPage({ film, tune, host: root, frames, ...(slots ? { slots } : {}) });
    return;
  }
  const studio = createStudio({
    root, film, tune, ...(slots ? { slots } : {}),
    ...(live ? { save: async (t: Tune) => { const r = await fetch('/api/tune', { method: 'PUT', body: JSON.stringify(t) }); if (!r.ok) throw new Error(String(r.status)); } } : {}),
  });
  window.motionStudio = studio;
  // The agent edits the film file; the page follows without losing the playhead or the tuning.
  if (live) new EventSource('/api/events').addEventListener('film', (e) => studio.setFilm(JSON.parse((e as MessageEvent<string>).data) as Film));
}

window.ready = main().then(() => true);
