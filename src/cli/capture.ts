// Screenshots of a web page for a film: the whole page, or each section on its
// own (--sections), at 2× by default, with cookie banners and fixed headers
// hidden so every picture is clean.
import fs from 'node:fs';
import path from 'node:path';
import { browserPath, launch } from './browser.ts';

export interface CaptureOptions {
  url: string;
  out: string;
  sections: boolean;
  /** CSS selector for the sections. Default: `section`, then the children of `main`. */
  selector?: string;
  width: number;
  scale: number;
  /** Extra selectors to hide. */
  hide: string[];
  keepBanners: boolean;
  keepHeader: boolean;
  browser?: string;
}

export interface Captured { file: string; name: string; selector: string; x: number; y: number; width: number; height: number }

/** Consent and cookie banners from common providers, and the usual hand-made ones. */
export const BANNERS = [
  '#onetrust-consent-sdk', '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay', '#usercentrics-root',
  '#cookiescript_injected', '.cc-window', '.cc-banner', '#cmpbox', '#cmpbox2', '.qc-cmp2-container', '#didomi-host', '#truste-consent-track',
  '#hs-eu-cookie-confirmation', '.osano-cm-window', '#axeptio_overlay', '#tarteaucitronRoot', '.fc-consent-root', '#sp_message_container',
  '[id*="cookie-banner" i]', '[class*="cookie-banner" i]', '[id*="cookie-consent" i]', '[class*="cookie-consent" i]', '[id*="cookie-notice" i]',
  '[class*="cookie-notice" i]', '[aria-label*="cookie" i][role="dialog"]', '[aria-label*="consent" i][role="dialog"]',
];

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function capture(o: CaptureOptions): Promise<Captured[]> {
  const browser = await launch(browserPath(o.browser));
  try {
    const page = await browser.newPage({ viewport: { width: o.width, height: 900 }, deviceScaleFactor: o.scale });
    try { await page.goto(o.url, { waitUntil: 'networkidle', timeout: 45_000 }); } catch { await page.goto(o.url, { waitUntil: 'load', timeout: 60_000 }); }
    const hide = [...(o.keepBanners ? [] : BANNERS), ...o.hide];
    if (hide.length) await page.addStyleTag({ content: `${hide.join(',\n')} { display: none !important; }\nhtml, body { overflow: visible !important; }` });
    // Scroll through once so lazy pictures load and scroll-triggered reveals finish.
    await page.evaluate(async () => {
      const step = Math.max(200, Math.round(innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      scrollTo(0, 0);
      await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 5000); })));
    });
    if (!o.keepHeader) {
      // Headers and bars that stay put would sit on top of every section.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll<HTMLElement>('body *')) {
          const pos = getComputedStyle(el).position;
          if (pos === 'fixed') el.style.setProperty('display', 'none', 'important');
          else if (pos === 'sticky') el.style.setProperty('position', 'relative', 'important');
        }
      });
    }
    await page.waitForTimeout(300);
    fs.mkdirSync(o.out, { recursive: true });
    if (!o.sections) {
      const file = path.join(o.out, 'page.png');
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
      return [{ file, name: 'page', selector: 'html', x: 0, y: 0, width: size[0]!, height: size[1]! }];
    }
    const found = await page.evaluate((sel) => {
      const pick = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
      let els = sel ? pick(sel) : pick('section');
      let used = sel || 'section';
      if (!sel && els.length < 2) { els = pick('main > *'); used = 'main > *'; }
      if (!sel && els.length < 2) { els = pick('body > *'); used = 'body > *'; }
      // Outermost matches only, and only what has a size.
      els = els.filter((e) => !els.some((o) => o !== e && o.contains(e)));
      return els.map((e, i) => {
        const r = e.getBoundingClientRect();
        e.setAttribute('data-motion-capture', String(i));
        const heading = e.querySelector('h1, h2, h3')?.textContent?.trim() ?? '';
        return { i, used, id: e.id, label: e.getAttribute('aria-label') ?? '', heading, x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      }).filter((e) => e.width >= 50 && e.height >= 50);
    }, o.selector ?? '');
    if (!found.length) throw new Error(`No sections found${o.selector ? ` for "${o.selector}"` : ''}. Name them with --selector, e.g. --selector "main > div".`);
    const shots: Captured[] = [];
    for (const [n, s] of found.entries()) {
      const name = `${String(n + 1).padStart(2, '0')}${slug(s.id || s.label || s.heading) ? `-${slug(s.id || s.label || s.heading)}` : ''}`;
      const file = path.join(o.out, `${name}.png`);
      await page.locator(`[data-motion-capture="${s.i}"]`).screenshot({ path: file, animations: 'disabled' });
      shots.push({ file, name, selector: s.used, x: Math.round(s.x), y: Math.round(s.y), width: Math.round(s.width), height: Math.round(s.height) });
    }
    return shots;
  } finally { await browser.close(); }
}
