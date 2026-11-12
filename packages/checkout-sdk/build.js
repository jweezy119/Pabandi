const { build } = require('../../server/node_modules/esbuild');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('[checkout-sdk] Building bundles...');

  // Ensure dist directories
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'dist/react'), { recursive: true });

  // 1. Core ESM & CJS
  await build({
    entryPoints: [path.join(__dirname, 'src/index.ts')],
    outfile: path.join(__dirname, 'dist/index.mjs'),
    bundle: true,
    format: 'esm',
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
  });

  await build({
    entryPoints: [path.join(__dirname, 'src/index.ts')],
    outfile: path.join(__dirname, 'dist/index.js'),
    bundle: true,
    format: 'cjs',
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
  });

  // 2. Browser Global (IIFE / script tag)
  await build({
    entryPoints: [path.join(__dirname, 'src/index.ts')],
    outfile: path.join(__dirname, 'dist/index.global.js'),
    bundle: true,
    format: 'iife',
    globalName: 'Pabandi',
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
  });

  // 3. React ESM & CJS
  await build({
    entryPoints: [path.join(__dirname, 'src/react/index.ts')],
    outfile: path.join(__dirname, 'dist/react/index.mjs'),
    bundle: true,
    format: 'esm',
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
    external: ['react', 'react-dom'],
  });

  await build({
    entryPoints: [path.join(__dirname, 'src/react/index.ts')],
    outfile: path.join(__dirname, 'dist/react/index.js'),
    bundle: true,
    format: 'cjs',
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
    external: ['react', 'react-dom'],
  });

  console.log('[checkout-sdk] Generating TypeScript declarations...');
  try {
    const tscBin = path.join(__dirname, '../../server/node_modules/.bin/tsc');
    execSync(`${tscBin} --emitDeclarationOnly`, { cwd: __dirname, stdio: 'inherit' });
  } catch (err) {
    console.warn('[checkout-sdk] tsc declaration warning:', err.message);
  }

  console.log('[checkout-sdk] Build finished successfully!');
}

run().catch((err) => {
  console.error('[checkout-sdk] Build failed:', err);
  process.exit(1);
});
