// Cross-platform wrapper for the read-only static build, so the same command
// works in PowerShell, bash and CI: `npm run build:static`.
//
// Pass --base "" to build for a custom domain served from the site root.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const argIndex = process.argv.indexOf('--base');
const base = argIndex !== -1 ? process.argv[argIndex + 1] ?? '' : undefined;

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_STATIC_EXPORT: '1',
    ...(base !== undefined ? { PAGES_BASE_PATH: base } : {}),
  },
});

if (result.status !== 0) process.exit(result.status ?? 1);

// GitHub Pages runs Jekyll by default, which skips directories beginning with
// an underscore — including Next's _next/ asset directory.
fs.writeFileSync('out/.nojekyll', '');
console.log('\nStatic site written to out/ (with .nojekyll)');
