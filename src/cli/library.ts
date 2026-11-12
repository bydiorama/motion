// The library entries (library/**/*.md) as data: styles, narratives and every
// primitive with its status. Written to library.json by `motion catalog --write`,
// so the wizard and the brief read one file and never parse Markdown in a browser.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { Family, Library } from '../brief/types.ts';
import { ROOT } from './files.ts';

function entries(dir: string): { meta: Record<string, unknown>; body: string }[] {
  const out: { meta: Record<string, unknown>; body: string }[] = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.md')) {
        const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(fs.readFileSync(p, 'utf8'));
        if (m) out.push({ meta: parse(m[1]!) as Record<string, unknown>, body: m[2]! });
      }
    }
  };
  walk(dir);
  return out;
}

/** The first paragraph under a heading, e.g. a style's "Character". */
const section = (body: string, heading: string): string => {
  const m = new RegExp(`^## ${heading}\\s*\\n+([\\s\\S]*?)(?:\\n\\n|\\n##|$)`, 'm').exec(body);
  return m ? m[1]!.trim().replace(/\s+/g, ' ') : '';
};

const FAMILIES: Family[] = ['product', 'brand', 'graphics', 'social'];
type Range = { min: number; max: number };
const range = (v: unknown): Range => {
  const r = (v ?? {}) as Partial<Range>;
  return { min: Number(r.min ?? 0), max: Number(r.max ?? 0) };
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function readLibrary(root = path.join(ROOT, 'library')): Library {
  const all = entries(root);
  const of = (kind: string) => all.filter((e) => e.meta.kind === kind);
  return {
    styles: of('style').map(({ meta, body }) => ({
      slug: String(meta.slug), summary: String(meta.summary ?? ''), character: section(body, 'Character'),
      uses: strings(meta.uses), avoids: strings(meta.avoids), formats: strings(meta.formats), duration: range(meta.duration),
      beat: Number((meta.tokens as { beat?: number } | undefined)?.beat ?? 0) || undefined,
    })),
    narratives: of('narrative').map(({ meta }) => ({
      slug: String(meta.slug), summary: String(meta.summary ?? ''), family: (FAMILIES.includes(meta.family as Family) ? meta.family : 'graphics') as Family,
      duration: range(meta.duration), fits: strings(meta.fits_styles),
      beats: ((meta.beats ?? []) as Record<string, unknown>[]).map((b) => ({
        name: String(b.name), share: Number(b.share), content: String(b.content ?? ''), primitives: strings(b.primitives),
      })),
    })),
    primitives: of('primitive').map(({ meta }) => ({ slug: String(meta.slug), summary: String(meta.summary ?? ''), status: String(meta.status ?? 'draft') })),
  };
}
