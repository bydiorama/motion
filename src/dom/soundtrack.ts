// The film's soundtrack in a browser: one audio element that follows the playhead.
// The film's clock leads; the sound is corrected when it drifts from it, and
// jumps with every seek and every turn of a loop. A render never plays it: render
// lays the file under the video with ffmpeg.
import type { FilmAudio } from '../film/types.ts';

/** How far the sound may drift from the playhead before it is put back, seconds. */
export const DRIFT = 0.06;

/** Where in the file the film at time t plays. */
export const fileTime = (a: Pick<FilmAudio, 'from'>, t: number): number => (a.from ?? 0) + Math.max(0, t);

/** The element's volume for a level in dB (an element cannot go above 1). */
export const volumeOf = (gain = 0): number => Math.min(1, Math.max(0, 10 ** (gain / 20)));

export interface Soundtrack {
  /** Call on every frame the film draws: the playhead, and whether it is running. */
  sync(t: number, playing: boolean): void;
  dispose(): void;
}

export function createSoundtrack(audio: FilmAudio, doc: Document = document): Soundtrack {
  const el = doc.createElement('audio');
  el.src = audio.src;
  el.preload = 'auto';
  el.volume = volumeOf(audio.gain);
  let wanted = false;
  return {
    sync(t, playing) {
      const at = fileTime(audio, t);
      if (!playing) {
        wanted = false;
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - at) > 1 / 120) el.currentTime = at;
        return;
      }
      if (!wanted || el.paused) {
        wanted = true;
        el.currentTime = at;
        // A browser plays sound only after the person has clicked on the page; until
        // then the film runs silent and the next play tries again.
        void el.play().catch(() => { wanted = false; });
        return;
      }
      if (Math.abs(el.currentTime - at) > DRIFT) el.currentTime = at;
    },
    dispose() { el.pause(); el.removeAttribute('src'); el.load(); },
  };
}
