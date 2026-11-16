// Opens a film in a headless browser at its own pixel size, ready to seek.
import type { Browser, Page } from 'playwright';
import type { LayerBox } from '../dom/mount.ts';
import type { Timeline } from '../film/types.ts';
import { prepareFrames } from './frames.ts';
import { serve } from './server.ts';

export interface Session {
  page: Page;
  duration: number;
  fps: number;
  frames: number;
  size: [number, number];
  /** Errors the page raised: script errors, failed requests, fonts that did not load. */
  errors: string[];
  seek(t: number): Promise<void>;
  audit(t: number): Promise<LayerBox[]>;
  close(): Promise<void>;
}

/** The browser to draw with: --browser, then MOTION_CHROMIUM, then Playwright's own. */
export const browserPath = (flag?: unknown): string | undefined =>
  (typeof flag === 'string' && flag ? flag : undefined) ?? (process.env.MOTION_CHROMIUM || undefined);

export async function launch(executable?: string): Promise<Browser> {
  let chromium: typeof import('playwright').chromium;
  try { ({ chromium } = await import('playwright')); } catch { throw new Error('This command draws frames in a browser and needs Playwright. Run: pnpm install && pnpm exec playwright install chromium'); }
  try {
    return await chromium.launch(executable ? { executablePath: executable } : {});
  } catch (e) {
    const hint = executable
      ? `Could not start the browser at ${executable}.`
      : 'Playwright\'s Chromium is not installed. Run: pnpm exec playwright install chromium, or point at an installed Chromium-based browser (Chrome, Brave, Edge) with --browser <path> or MOTION_CHROMIUM.';
    throw new Error(`${hint}\n${(e as Error).message.split('\n')[0]}`);
  }
}

export async function open(film: string, opts: { css?: string[]; scale?: number; size: [number, number]; timeline?: Timeline; browser?: string }): Promise<Session> {
  // Footage is pulled before the page opens, so every frame of it is exact.
  const frames = opts.timeline ? await prepareFrames(film, opts.timeline, opts.scale ?? 1, (m) => process.stderr.write(`${m}\n`)) : {};
  const preview = await serve({ film, frames, ...(opts.css ? { css: opts.css } : {}) });
  let browser: Browser | undefined;
  try {
    // --browser or MOTION_CHROMIUM point at a Chromium binary when Playwright's own download is not there.
    browser = await launch(browserPath(opts.browser));
    const context = await browser.newContext({ viewport: { width: opts.size[0], height: opts.size[1] }, deviceScaleFactor: opts.scale ?? 1 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // A load the page itself cancelled (a footage frame replaced by the next one) is not a failure.
    page.on('requestfailed', (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`Request failed: ${r.url()}`); });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${preview.url}#render`);
    try { await page.evaluate(() => window.ready); } catch (e) { throw new Error(`The film did not load.\n${errors.join('\n') || (e as Error).message}`); }
    const info = await page.evaluate(() => ({
      duration: window.duration, fps: window.fps,
      fonts: [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family),
    }));
    for (const f of info.fonts) errors.push(`Font did not load: ${f}`);
    const b = browser;
    return {
      page, errors, duration: info.duration, fps: info.fps, frames: Math.round(info.duration * info.fps), size: opts.size,
      seek: (t) => page.evaluate((x) => window.seek(x), t),
      audit: (t) => page.evaluate((x) => window.audit(x), t),
      close: async () => { await b.close(); await preview.close(); },
    };
  } catch (e) {
    await browser?.close();
    await preview.close();
    throw e;
  }
}
