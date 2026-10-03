import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Client tests.
//
// WHY THIS FILE EXISTS
// --------------------
// The client had no test runner at all — zero test files. That is why
// `<Navigate to="/" replace />` sat in BusinessGuard for long enough to be reported
// as "clicking Contact OS brings us back to pabandi.com": nothing could assert that a
// click on a visible nav link goes where the link says.
//
// The 552 server tests cannot cover this. The guard is client-side routing, and the
// class of bug is a disagreement between two pieces of client code (the nav offers a
// link, the guard refuses it) that only shows up when they run together.
//
// jsdom, not a browser runner: these are routing and conditional-render assertions
// with no layout or real network. Keeps CI fast and dependency-light.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
