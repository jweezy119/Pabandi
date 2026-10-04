import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: env.VITE_BASE || '/',
  // The commit this bundle was built from, compiled in.
  //
  // Used by src/utils/staleTab.ts to notice when the tab is running an older build than
  // the server is serving, and to reload instead. See that file for why a customer kept
  // hitting a fixed bug for several deploys.
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.BUILD_SHA || 'dev'),
  },
  plugins: [
    react(),
    // Precache OFF, and the service worker disabled entirely.
    //
    // This shipped a precache manifest listing hashed bundles — including ones from
    // earlier builds, which kept resolving to whatever the browser had stored. A
    // deployed fix then reached the server and never reached the browser: the
    // customer was running a bundle several builds old whose asset URL 404s on the
    // server, and whose code still contained the bug being fixed.
    //
    // `registerSW` was never called in the app, so the worker was orphaned but
    // still deployed at /sw.js and still intercepting. Precaching the app shell for
    // a dashboard that is served with fresh headers on every load buys nothing: the
    // shell is already cheap, and the assets are content-hashed so they are safe to
    // fetch directly.
    //
    // If a PWA is wanted later it needs a decision about update UX, not a silent
    // precache — a customer stuck on an old bundle cannot be told so.
    VitePWA({
      registerType: 'autoUpdate',
      // Emit no worker at all, rather than emitting one nobody registers.
      disable: true,
      includeAssets: ['favicon.ico'],
      workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      manifest: {
        name: 'Pabandi CRM',
        short_name: 'Pabandi',
        description: 'Property Management & Sales CRM',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/external': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
};
});
