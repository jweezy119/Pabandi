import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm', 'iife'],
    globalName: 'Pabandi',
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
  },
  {
    entry: ['src/react/index.ts'],
    outDir: 'dist/react',
    format: ['cjs', 'esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    external: ['react', 'react-dom'],
  },
]);

