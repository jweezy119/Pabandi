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
         // Only libraries that are in the EAGER graph get a named bucket. The rule is
         // reachability, not size, and it has to be checked rather than assumed: see the
         // note on `heavy` below for what happens when a lazy-only library is forced into
         // a manual chunk.
         //
         // Everything else deliberately returns undefined and is left to Rollup's
         // automatic chunking. There is no catch-all `vendor` bucket any more, and that
         // removal is the point rather than an oversight — see the comment on `heavy`.
         manualChunks(id: string) {
           if (!id.includes('node_modules')) return undefined;
           if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
           if (/[\\/]node_modules[\\/](react-router|react-router-dom|react-query|@tanstack)[\\/]/.test(id)) return 'router';
           if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
           if (/[\\/]node_modules[\\/]react-icons[\\/]/.test(id)) return 'icons';
           if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'http';
           // Solana, leaflet and qrcode must NOT be named here.
           //
           // They lived in a `heavy` bucket until 2026-10-10, and it was load-breaking as
           // well as wasteful. Nothing in the eager graph reaches them — only four pages
           // do, via utils/web3.ts (AuthPage, BookingPage, BusinessProfilePage,
           // NewReservationPage) and the two leaflet maps — yet with the bucket in place
           // the ENTRY chunk statically imported `heavy-Ng0mja7S.js`, and so did 203 of
           // the 260 route chunks. That put 290 KB of wallet and map code in every
           // visitor's first paint.
           //
           // Worse, `heavy` threw
           //     Uncaught TypeError: Cannot read properties of undefined (reading 'Buffer')
           // while evaluating — its commonjs `safe-buffer` interop read a module before
           // it was initialised. A module that throws during evaluation fails the whole
           // graph, so React never mounted on ANY page: pabandi.com served a blank
           // document, and every click did nothing, which users reported as being
           // "sent back to pabandi.com". Verified against the deployed bundle.
           //
           // Returning undefined leaves these to automatic chunking, which puts them in a
           // dynamic chunk that only the four pages load, and evaluates it only after the
           // rest of the graph. Leaving them in the catch-all instead is equally wrong:
           // that lands them in `vendor`, which the entry does import statically.
           return undefined;
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
