const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function transpileDir(srcDir, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const outPath = path.join(outDir, entry);
    
    if (fs.statSync(srcPath).isDirectory()) {
      await transpileDir(srcPath, outPath);
    } else if (entry.endsWith('.ts')) {
      const result = await esbuild.build({
        entryPoints: [srcPath],
        bundle: false,
        platform: 'node',
        target: 'node22',
        outfile: outPath.replace('.ts', '.js'),
        format: 'cjs',
      });
      process.stdout.write('.');
    }
  }
}

transpileDir('src', 'dist/src').then(() => {
  console.log('\nesbuild transpile complete');
  process.exit(0);
}).catch((err) => {
  console.error('esbuild failed:', err);
  process.exit(1);
});
