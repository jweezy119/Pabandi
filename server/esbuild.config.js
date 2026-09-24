const esbuild = require('esbuild');
const { readdirSync, statSync, existsSync, mkdirSync, copySync } = require('fs-extra');
const path = require('path');

// Transpile all .ts files to .js (no bundling, keeps tsc-like output)
async function transpileDir(dir) {
  const outDir = dir.replace('src', 'dist/src');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const outPath = path.join(outDir, entry);

    if (statSync(fullPath).isDirectory()) {
      await transpileDir(fullPath);
    } else if (entry.endsWith('.ts')) {
      const outFile = outPath.replace('.ts', '.js');
      await esbuild.build({
        entryPoints: [fullPath],
        bundle: false,
        platform: 'node',
        target: 'node22',
        outfile: outFile,
        format: 'cjs',
        sourcemap: true,
      });
    }
  }
}

transpileDir('src').then(() => {
  console.log('esbuild transpile complete');
  process.exit(0);
}).catch((err) => {
  console.error('esbuild failed:', err);
  process.exit(1);
});
