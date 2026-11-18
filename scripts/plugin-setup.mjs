#!/usr/bin/env node
// SessionStart hook of the Claude Code plugin (hooks/hooks.json).
//
// The plugin is this repository, copied into Claude Code's plugin cache. Claude Code
// installs a plugin's npm packages only from an npm or Bun lockfile, and this repository
// is locked with pnpm, so the runtime's packages (`dependencies` in package.json) are
// installed here instead: once into the plugin's data directory, which survives
// updates, then linked into the copy as node_modules so the CLI resolves them.
//
// It runs at every session start, so the common case (nothing changed) costs one file
// read. It never fails the session: a failed install is reported and retried next time.
// Chromium is not installed here (it is large); the motion-film skill says how.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PLUGIN_ROOT;
const data = process.env.CLAUDE_PLUGIN_DATA;
if (!root || !data) process.exit(0); // Not running as a plugin: nothing to do.

const say = (m) => process.stderr.write(`motion plugin: ${m}\n`);

try {
  // A clone loaded in place (`--plugin-dir`, a local marketplace) has its own packages.
  const own = path.join(root, 'node_modules');
  if (fs.existsSync(own) && !fs.lstatSync(own).isSymbolicLink()) process.exit(0);

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = `${JSON.stringify({ name: 'motion-plugin-runtime', private: true, dependencies: pkg.dependencies ?? {} }, null, 2)}\n`;
  const want = path.join(data, 'package.json');
  const modules = path.join(data, 'node_modules');
  const done = path.join(data, '.installed');

  // Install when the dependency list changed since the last install that finished.
  const current = fs.existsSync(done) && fs.readFileSync(done, 'utf8') === manifest;
  if (!current) {
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(want, manifest);
    fs.rmSync(done, { force: true });
    say('installing the runtime packages…');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const r = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--loglevel=error', '--update-notifier=false'], { cwd: data, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
    if (r.status !== 0) {
      say(`npm install failed in ${data}. It will be tried again next session.`);
      process.exit(0);
    }
    fs.writeFileSync(done, manifest);
  }

  // Link the packages into this version of the plugin (each version has its own copy).
  if (!fs.existsSync(own)) fs.symlinkSync(modules, own, process.platform === 'win32' ? 'junction' : 'dir');
} catch (e) {
  say(`setup did not finish: ${e instanceof Error ? e.message : e}`);
}
