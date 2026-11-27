// Produce the npm payload separately from the source checkout and plugin ZIP.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, ROOT, wizardScript } from '../src/cli/files.ts';

const output = path.join(ROOT, 'dist/npm');
rmSync(output, { recursive: true, force: true });
execFileSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/bin/tsc')), '-p', 'tsconfig.package.json'], {
  cwd: ROOT, stdio: 'inherit',
});
chmodSync(path.join(output, 'cli/motion.js'), 0o755);
const assets = path.join(output, 'browser');
mkdirSync(assets, { recursive: true });
await bundle(assets);
writeFileSync(path.join(assets, 'wizard.js'), await wizardScript());
