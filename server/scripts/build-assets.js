/**
 * build-assets.js — post-compile asset staging.
 *
 * Two things must exist inside the runtime image, because the repo root is not
 * copied into it:
 *
 *   1. dist/sql/agent-tables.sql — read by the runtime table bootstrap.
 *   2. dist/src/public/{llms.txt,robots.txt,openapi.yaml} — the discovery files
 *      an agent fetches. Serving them from a build artifact (rather than from
 *      the repo root at request time) means the served bytes are exactly the
 *      bytes we generate, in source mode and in the image alike.
 */
const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(SERVER_ROOT, '..');

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`staged ${path.relative(SERVER_ROOT, dest)}`);
  } catch (e) {
    console.warn(`skipped ${src} -> ${dest}: ${e.code}`);
  }
}

// 1. public assets + sql
copyDir(path.join(SERVER_ROOT, 'src', 'public'), path.join(SERVER_ROOT, 'dist', 'src', 'public'));
copyDir(path.join(SERVER_ROOT, 'sql'), path.join(SERVER_ROOT, 'dist', 'sql'));

// 2. discovery files
copyFile(path.join(REPO_ROOT, 'llms.txt'), path.join(SERVER_ROOT, 'src', 'public', 'llms.txt'));
copyFile(path.join(REPO_ROOT, 'robots.txt'), path.join(SERVER_ROOT, 'src', 'public', 'robots.txt'));
copyFile(path.join(SERVER_ROOT, 'openapi.yaml'), path.join(SERVER_ROOT, 'src', 'public', 'openapi.yaml'));

// The SPA build overwrites src/public/app at image build time, after this runs,
// so re-stage the discovery files on top of it.
const SPA_APP = path.join(SERVER_ROOT, 'src', 'public', 'app');
if (fs.existsSync(SPA_APP)) {
  for (const name of ['llms.txt', 'robots.txt', 'openapi.yaml']) {
    const from = path.join(SERVER_ROOT, 'src', 'public', name);
    const to = path.join(SPA_APP, name);
    if (fs.existsSync(from)) copyFile(from, to);
  }
}

if (!fs.existsSync(path.join(SERVER_ROOT, 'dist', 'src', 'index.js'))) {
  console.error('dist/src/index.js missing — compile failed');
  process.exit(1);
}
console.log('assets staged');
