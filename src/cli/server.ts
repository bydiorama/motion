// The preview server. It serves the page, the film and tune files, and tells the
// page when the film file changes. It binds to this machine only.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { bundle, readTune, tunePath, writeJson } from './files.ts';
import type { Tune } from '../film/types.ts';
import type { FrameSequence } from '../primitives/types.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4',
  '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.ogv': 'video/ogg', '.avif': 'image/avif', '.gif': 'image/gif',
};

export interface ServerOptions {
  film: string; css?: string[]; port?: number; watch?: boolean;
  /** Footage frames for el/video layers, by "<scene>/<layer>", served at /api/frames. */
  frames?: Record<string, FrameSequence>;
  /** Serve no tuning, as if the tune file were empty: stills, checks and renders of the film as written. */
  noTune?: boolean;
}
export interface Preview { url: string; close(): Promise<void> }

export const shell = (head: string, body = ''): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion</title>
<link rel="icon" href="data:,">
<style>html, body { margin: 0; }</style>
${head}
</head>
<body>
<div id="app"></div>
${body}
</body>
</html>
`;

/** Resolves a request path inside a folder, or returns undefined if it would leave it. */
function inside(dir: string, rel: string): string | undefined {
  const target = path.resolve(dir, `.${path.posix.normalize(`/${rel}`)}`);
  return target === dir || target.startsWith(dir + path.sep) ? target : undefined;
}

export async function serve(options: ServerOptions): Promise<Preview> {
  const filmPath = path.resolve(options.film), filmDir = path.dirname(filmPath);
  const css = (options.css ?? []).map((f) => path.resolve(f));
  const page = await bundle();
  const clients = new Set<http.ServerResponse>();

  const send = (res: http.ServerResponse, status: number, type: string, body: string | Buffer) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };
  const file = (res: http.ServerResponse, target: string | undefined, range?: string) => {
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) return send(res, 404, 'text/plain', 'Not found');
    const type = MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    // Byte ranges: a browser only seeks in a video it can fetch in parts.
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (m && (m[1] || m[2])) {
      const size = fs.statSync(target).size;
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
      if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
      return fs.createReadStream(target, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes' });
    return res.end(fs.readFileSync(target));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    if (p === '/') {
      const links = css.map((f, i) => `<link rel="stylesheet" href="/css/${i}/${encodeURIComponent(path.basename(f))}">`).join('\n');
      return send(res, 200, MIME['.html']!, shell(links, '<script type="module" src="/page.js"></script>'));
    }
    if (p === '/page.js') return file(res, page);
    if (p === '/api/film') return file(res, filmPath);
    if (p === '/api/frames') return send(res, 200, MIME['.json']!, JSON.stringify(options.frames ?? {}));
    if (p === '/api/tune' && req.method === 'GET') return send(res, 200, MIME['.json']!, JSON.stringify(options.noTune ? { set: {}, notes: [] } : readTune(filmPath)));
    if (p === '/api/tune' && req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const tune = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Tune;
          writeJson(tunePath(filmPath), { set: tune.set ?? {}, notes: tune.notes ?? [] });
          send(res, 200, MIME['.json']!, '{"ok":true}');
        } catch { send(res, 400, 'text/plain', 'The tune must be JSON'); }
      });
      return;
    }
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    const m = /^\/css\/(\d+)\/(.+)$/.exec(p);
    if (m) {
      const sheet = css[Number(m[1])];
      return file(res, sheet ? inside(path.dirname(sheet), m[2]!) : undefined);
    }
    return file(res, inside(filmDir, p), req.headers.range);
  });

  let watcher: fs.FSWatcher | undefined, timer: NodeJS.Timeout | undefined;
  if (options.watch) {
    // Watch the folder, not the file: editors and agents often replace a file rather than write into it.
    watcher = fs.watch(filmDir, (_event, name) => {
      if (name !== path.basename(filmPath)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        let text: string;
        try { text = JSON.stringify(JSON.parse(fs.readFileSync(filmPath, 'utf8'))); } catch { return; } // half-written: wait for the next change
        for (const c of clients) c.write(`event: film\ndata: ${text}\n\n`);
      }, 80);
    });
  }

  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', resolve); });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => { watcher?.close(); for (const c of clients) c.end(); server.close(() => resolve()); server.closeAllConnections(); }),
  };
}
