/**
 * Notice when this tab is running an older build than the server is serving.
 *
 * WHY THIS EXISTS
 * ---------------
 * A fix for "clicking Contact OS bounces to the homepage" was shipped and verified in the
 * deployed bundle. The customer kept seeing the bug, and their console named a bundle
 * hash that no longer existed on the server.
 *
 * The cause is a combination of two things that are individually correct:
 *
 *   1. `assets/**` is served `max-age=31536000, immutable`. Correct — the filenames are
 *      content-hashed, so a cached bundle can never be stale *for its own hash*.
 *   2. Firebase rewrites `**` to `/index.html`. Correct for client-side routing, but it
 *      also means a request for a bundle that no longer exists returns **HTML with a
 *      200**, not a 404.
 *
 * So a tab opened before a deploy keeps its old entry HTML, keeps running old code, and
 * any lazily-loaded chunk it asks for comes back as HTML — which fails to parse and
 * surfaces as an unrelated-looking syntax error. Nothing tells the user to reload. This
 * file is what tells them.
 *
 * The project has been bitten by this shape of problem more than once: a two-day site
 * drift where the API was current and the site was not, and a Save button that "did
 * nothing" because the browser was running code from before the fix.
 *
 * WHAT IT DOES
 * ------------
 * Fetches the server's `index.html` (no-store, so it is never itself cached), reads which
 * bundle it references, and compares that with the hash compiled into this bundle. If they
 * differ, the server has a newer build than the tab is running, so it reloads once.
 *
 * Guarded by `sessionStorage` so a reload cannot become a loop, and it never reloads when
 * the check itself fails — a network blip must not become a refresh loop on a page
 * someone is in the middle of using.
 */

declare const __BUILD_SHA__: string;

/** sessionStorage key marking that we have already reloaded once for staleness. */
const RELOADED_KEY = 'pabandi:stale-reloaded';

/** How often to re-check. Cheap, but not on every render. */
const CHECK_INTERVAL_MS = 60_000;

let inFlight = false;

/**
 * The actual reload, behind a seam.
 *
 * jsdom's `window.location` cannot be redefined or spied on — assigning it throws
 * "Cannot assign to read only property" — so a test that wanted to assert "this reloads"
 * had no way to observe it. Injecting the side effect keeps the decision logic (which is
 * what matters, and what regressed) testable without mocking the whole browser.
 */
let doReload: () => void = () => {
  // `replace` rather than `reload`, so the stale entry is not left in history for Back.
  window.location.replace(window.location.href);
};

/** Test seam. Not used by the app. */
export function __setReload(fn: () => void): void {
  doReload = fn;
}

/**
 * The bundle filename the server's index.html points at.
 *
 * Parsed with a regex rather than a DOM parse because this runs before React mounts and
 * must not depend on the document being ready.
 */
export function bundleHashFromHtml(html: string): string | null {
  const match = /\/assets\/index-([A-Za-z0-9_-]+)\.js/.exec(html);
  return match ? match[1] : null;
}

/**
 * The hash out of a script src, which may be a bare filename or a full path.
 *
 * One function for both sides of the comparison. The first version normalised with
 * `.replace(/^index-/, '')` on the value returned by `currentBundleHash()`, which is a
 * full `/assets/index-X.js` path — so the prefix never matched, the two sides were never
 * equal, and the detector would have reloaded on EVERY page load. The once-per-build
 * guard hid it: it fired once and then looked like it was working.
 */
export function hashFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = /index-([A-Za-z0-9_-]+)\.js/.exec(src);
  return match ? match[1] : null;
}

/** Is the server serving a different build than the one this tab is running? */
export function isStale(html: string, currentSrc: string | null | undefined): boolean {
  const serverBundle = bundleHashFromHtml(html);
  const mine = hashFromSrc(currentSrc);
  if (!serverBundle || !mine) return false;
  return serverBundle !== mine;
}

/**
 * Compare, and reload once if the server has moved on.
 *
 * @param currentBundleHash the hashed filename of the bundle this tab loaded, e.g.
 *        `index-CasA4obP.js`, or `index-CasA4obP`. Taken from the document's own script
 *        tags rather than from the compile-time sha, because THAT is what the server's
 *        index.html can be compared against.
 */
export async function checkForStaleBuild(currentBundleHash: string | null): Promise<boolean> {
  if (inFlight) return false;
  if (!currentBundleHash) return false;

  try {
    const res = await fetch('/index.html', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return false;

    const html = await res.text();
    const serverBundle = bundleHashFromHtml(html);
    if (!serverBundle) return false;

    const mine = hashFromSrc(currentBundleHash);
    if (!mine) return false;
    if (serverBundle === mine) return false;

    if (sessionStorage.getItem(RELOADED_KEY) === serverBundle) return false;
    sessionStorage.setItem(RELOADED_KEY, serverBundle);

    doReload();
    return true;
  } catch {
    // A failed check must never reload. Someone mid-transaction does not lose it to a
    // network blip, and a reload loop is worse than a stale tab.
    return false;
  } finally {
    inFlight = false;
  }
}

/** The hashed bundle filename this document actually loaded. */
export function currentBundleHash(doc: Document = document): string | null {
  const scripts = Array.from(doc.querySelectorAll('script[src]'));
  const own = scripts.find((s) => /\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(s.getAttribute('src') || ''));
  return own ? own.getAttribute('src') : null;
}

/**
 * Start watching. Called once at boot.
 *
 * First check is deferred so it never competes with the initial render, and a tab that is
 * merely left open picks up a deploy on its next check rather than needing a refresh.
 */
export function watchForStaleBuild(): void {
  const run = () => {
    void checkForStaleBuild(currentBundleHash());
  };

  if (typeof window === 'undefined') return;

  setTimeout(run, CHECK_INTERVAL_MS);
  window.addEventListener('focus', run);
  // A tab returning from another tab fires `visibilitychange`; checking then is what
  // catches "I left this open, you deployed, I came back".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
}

/** Exposed for tests and for the smoke check. */
export const buildSha = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'dev';
