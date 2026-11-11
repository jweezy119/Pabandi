import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Service Coordinator surface.
 *
 * Runs against the standalone harness entry (`coordinator-shell.html`), not
 * the `/coordinator` route — see the comment in src/coordinator-shell-main.tsx
 * for why the route is unreachable from an unauthenticated browser test.
 *
 * `channel: 'chrome'` drives the machine's installed Chrome instead of
 * downloading a Playwright-managed build. That keeps `npm install` small and
 * makes the test run against the browser the demo will actually be shown in.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: process.env.PW_CHANNEL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `--host 127.0.0.1` is required, not cosmetic: Vite's default bind is
    // `localhost`, which on this machine resolves to `::1` only, so a
    // health check against 127.0.0.1 hangs until the webServer timeout even
    // though the server is up.
    command: 'npm run dev -- --port 5174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5174/coordinator-shell.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
