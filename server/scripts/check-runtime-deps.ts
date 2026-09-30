#!/usr/bin/env npx tsx
/**
 * check-runtime-deps.ts — build gate.
 *
 * The server imports packages that were never declared in package.json. They
 * only resolved because of hoisting in a developer's node_modules, so a clean
 * production install crashed at boot (or worse, only on the route that needed
 * them). This walks the compiled output, resolves every bare require, and fails
 * on anything the manifest does not declare.
 *
 * Run: npm run check:runtime-deps   (wired into the Docker build)
 */
import fs from 'fs';
import path from 'path';
import { builtinModules } from 'module';

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'src');

// Packages that are intentionally absent from the production image. Each entry
// must say why — an uncommented entry is a feature that 500s in production.
const OPTIONAL = new Set<string>();
const OPTIONAL_REASON: Record<string, string> = {
  '@tensorflow/tfjs': 'no-show prediction models; callers lazy-load and degrade when absent',
};

if (!fs.existsSync(DIST)) {
  console.error('✗ dist/src not found — run `npm run compile` first');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared = new Set([...Object.keys(pkg.dependencies ?? {})]);

const files: string[] = [];
(function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // dist/src/public holds the built CLIENT bundle — its requires are the
      // browser's business, resolved by the client's own package.json.
      if (entry.name === 'public') continue;
      walk(p);
    }
    else if (entry.name.endsWith('.js')) files.push(p);
  }
})(DIST);

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const required = new Map<string, Set<string>>();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/require\(["']([^"'./][^"']*)["']\)/g)) {
    const spec = m[1];
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (required.has(name)) required.get(name)!.add(path.relative(DIST, f));
    else required.set(name, new Set([path.relative(DIST, f)]));
  }
}

const missing: string[] = [];
const optionalPresent: string[] = [];
for (const [name, importers] of required) {
  if (declared.has(name) || builtins.has(name)) continue;
  if (OPTIONAL.has(name) || name in OPTIONAL_REASON) {
    optionalPresent.push(`${name} (imported by ${[...importers][0]})`);
    continue;
  }
  missing.push(`${name} — imported by ${[...importers].slice(0, 3).join(', ')}`);
}

for (const o of optionalPresent) console.log(`NOTE  optional, not installed: ${o} — ${OPTIONAL_REASON[Object.keys(OPTIONAL_REASON).find((k) => o.startsWith(k)) ?? ''] ?? 'see OPTIONAL_REASON'}`);

if (missing.length > 0) {
  console.error(`\n✗ ${missing.length} undeclared runtime dependenc${missing.length === 1 ? 'y' : 'ies'}:`);
  for (const m of missing) console.error(`  - ${m}`);
  console.error('\nAdd them to "dependencies" in server/package.json, or make the import optional.');
  process.exit(1);
}

console.log(`✓ all ${required.size} runtime modules are declared in package.json`);
