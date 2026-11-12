#!/usr/bin/env node
// Node runs the TypeScript sources directly (type stripping), so there is no build step for the CLI.
import('../src/cli/main.ts').then((m) => m.main(process.argv.slice(2))).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
