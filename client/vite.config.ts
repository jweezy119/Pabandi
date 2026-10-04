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
  build: {
    rollupOptions: {
      output: {
        // Split the libraries that are large, stable and always needed into their own
        // long-lived chunks.
        //
        // Without this, route-level splitting alone leaves React, react-router, axios and
        // framer-motion duplicated across the lazy chunks, so a visitor pays for them
        // again on every navigation. Grouping them means they download once, in parallel
        // with the first route, and are then cached independently of app code.
        //
        // Keys are matched in order, so the specific libraries are listed before the
        // catch-all `vendor` — otherwise everything would land in one bucket and the
        // split would achieve nothing.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/](react-router|react-router-dom|react-query|@tanstack)[\\/]/.test(id)) return 'router';
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          // react-icons is split OUT of `heavy` on purpose.
          //
          // Grouping it with solana/leaflet meant that the single react-icons import in
          // the eager graph dragged the entire 345 KB `heavy` chunk into the first load —
          // one symbol pulled in a wallet library nobody on the CRM had asked for. The
          // general lesson: a manual chunk is a unit, so putting a small always-needed
          // library in the same bucket as a large rarely-needed one makes the bucket cost
          // the sum of both, on every visit.
          if (/[\\/]node_modules[\\/]react-icons[\\/]/.test(id)) return 'icons';
          // axios split out too, for the same reason as react-icons: `apiClient` is used by
          // the eager auth store, so axios was in the first load — and sharing a bucket
          // with solana/leaflet/qrcode meant those came with it.
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'http';
          if (/[\\/]node_modules[\\/](@solana|solana-web3|bs58|qrcode|leaflet)[\\/]/.test(id)) return 'heavy';
          return 'vendor';
        },
      },
    },
    // The old 500 KB warning is calibrated for a bundle that is mostly application code.
    // With deliberate chunking the entry chunk is small by design and a 3 MB vendor chunk
    // is expected, so the limit is raised to make a REAL regression visible again.
    chunkSizeWarningLimit: 1200,
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
