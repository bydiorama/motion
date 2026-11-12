import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Film, Tune } from '../film/types.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const tunePath = (filmPath: string): string => filmPath.replace(/(\.film)?\.json$/, '.tune.json');
export const filmName = (filmPath: string): string => path.basename(filmPath).replace(/(\.film)?\.json$/, '');

export function readJson<T>(file: string): T {
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); } catch { throw new Error(`Cannot read ${file}`); }
  try { return JSON.parse(text) as T; } catch (e) { throw new Error(`${file} is not valid JSON: ${(e as Error).message}`); }
}

export const readFilm = (file: string): Film => readJson<Film>(file);
export const readTune = (filmPath: string): Tune => (fs.existsSync(tunePath(filmPath)) ? readJson<Tune>(tunePath(filmPath)) : { set: {}, notes: [] });
export const writeJson = (file: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

export async function bundle(): Promise<string> {
  const { build } = await import('esbuild');
  const out = path.join(ROOT, 'dist');
  const common = { bundle: true, format: 'esm' as const, target: 'es2022', minify: true, legalComments: 'none' as const, logLevel: 'warning' as const, loader: { '.css': 'text' as const, '.woff2': 'dataurl' as const } };
  await build({ ...common, entryPoints: [path.join(ROOT, 'src/studio/entry.ts')], outfile: path.join(out, 'page.js') });
  await build({ ...common, entryPoints: [path.join(ROOT, 'src/index.ts')], outfile: path.join(out, 'motion.js') });
  return path.join(out, 'page.js');
}

/** The wizard as one page, with the catalog and the library inlined. */
export async function wizardPage(data: unknown): Promise<string> {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [path.join(ROOT, 'src/wizard/entry.ts')], bundle: true, format: 'esm', target: 'es2022', minify: true, write: false,
    legalComments: 'none', logLevel: 'warning', loader: { '.css': 'text', '.woff2': 'dataurl' },
  });
  const js = result.outputFiles[0]!.text.replace(/<\/script/g, '<\\/script');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion brief</title>
<meta name="color-scheme" content="light dark">
</head>
<body>
<div id="app"></div>
<script type="application/json" id="wizard-data">${json}</script>
<script type="module">${js}</script>
</body>
</html>
`;
}

/** A stylesheet with its relative url() files inlined, so a built film is one file. */
export function inlineCss(file: string): string {
  const dir = path.dirname(file);
  const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  return fs.readFileSync(file, 'utf8').replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/)([^'")]+)\1\s*\)/g, (whole, _q, ref: string) => {
    const target = path.resolve(dir, ref.split(/[?#]/)[0]!);
    const mime = MIME[path.extname(target).toLowerCase()];
    if (!mime || !fs.existsSync(target)) return whole;
    return `url(data:${mime};base64,${fs.readFileSync(target).toString('base64')})`;
  });
}
