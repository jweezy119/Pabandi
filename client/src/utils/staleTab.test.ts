import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  watchForStaleBuild,
  bundleHashFromHtml,
  isStale,
  currentBundleHash,
  checkForStaleBuild,
  __setReload,
} from './staleTab';

/**
 * A fix was shipped, verified in the deployed bundle, and the customer still saw the bug.
 * Their console named a bundle hash that no longer existed on the server.
 *
 * Cause: `assets/**` is cached for a year (correct — filenames are content-hashed) and
 * Firebase rewrites `**` to index.html, so a tab open across deploys keeps running old
 * code and a missing chunk returns HTML with a 200 instead of a 404. Nothing prompted a
 * reload.
 *
 * These tests pin the detector, and — more importantly — pin that a FAILED check never
 * reloads. A refresh loop would be worse than a stale tab.
 */

// jsdom's window.location cannot be redefined, so the reload is injected instead. The
// first version of this file stubbed location directly and every test in the block threw
// "Cannot assign to read only property".
let reload = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  reload = vi.fn();
  __setReload(reload);
});

afterEach(() => {
  __setReload(() => {});
});

/** Listeners registered by watchForStaleBuild, so a test can fire them. */
const watchForStaleBuildListeners = new Map<string, (e?: any) => void>();
const realAddEventListener = window.addEventListener.bind(window);

/** Stub the one request the detector makes: the server's index.html. */
function mockFetch(body: string, ok = true) {
  const spy = vi.fn(async () => ({ ok, text: async () => body } as unknown as Response));
  global.fetch = spy as never;
  return spy;
}

const html = (hash: string) =>
  `<!doctype html><html><head><script type="module" src="/assets/index-${hash}.js"></script></head></html>`;

describe('reading the bundle the server references', () => {
  it('extracts the hash', () => {
    expect(bundleHashFromHtml(html('CasA4obP'))).toBe('CasA4obP');
  });

  it('returns null when there is no entry bundle, rather than guessing', () => {
    // Guessing here would reload the page on any index.html shape we did not expect.
    expect(bundleHashFromHtml('<html><body>hi</body></html>')).toBeNull();
  });
});

describe('deciding whether this tab is stale', () => {
  it('is stale when the server references a different bundle', () => {
    expect(isStale(html('NEWONE'), '/assets/index-OLDONE.js')).toBe(true);
  });

  it('is not stale when they match', () => {
    // Given as a full src path, because that is what currentBundleHash() returns. The
    // first version compared a hashed name against a path, never matched, and reloaded
    // on every page load.
    expect(isStale(html('CasA4obP'), '/assets/index-CasA4obP.js')).toBe(false);
    expect(isStale(html('CasA4obP'), 'index-CasA4obP.js')).toBe(false);
  });

  it('does not decide staleness when it cannot identify this tab', () => {
    // No identifier on either side means no reload — guessing here is a refresh loop.
    expect(isStale(html('anything'), null)).toBe(false);
    expect(isStale('<html></html>', '/assets/index-x.js')).toBe(false);
  });
});

describe('reading the bundle this document loaded', () => {
  it('finds its own entry chunk', () => {
    document.head.innerHTML = '<script type="module" src="/assets/index-MINE123.js"></script>';
    expect(currentBundleHash()).toContain('MINE123');
  });

  it('returns null when there is no entry chunk', () => {
    document.head.innerHTML = '';
    expect(currentBundleHash()).toBeNull();
  });
});

describe('the reload decision', () => {
  it('reloads when the server has moved on', async () => {
    mockFetch(html('SERVERNEW'));

    const reloaded = await checkForStaleBuild('/assets/index-CLIENTOLD.js');

    expect(reloaded).toBe(true);
    expect(reload).toHaveBeenCalled();
  });

  it('does nothing when this tab is already current', async () => {
    mockFetch(html('SAMEONE'));

    expect(await checkForStaleBuild('/assets/index-SAMEONE.js')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  // The loop guard is the most important line in the file.
  it('reloads at most once per server build', async () => {
    mockFetch(html('SERVERNEW'));

    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // A second check against the same server build must not reload again — otherwise a
    // CDN that serves a different index.html would put the page in a refresh loop.
    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the server moves on a FURTHER build', async () => {
    mockFetch(html('BUILD2'));
    await checkForStaleBuild('/assets/index-CLIENTOLD.js');
    expect(reload).toHaveBeenCalledTimes(1);

    mockFetch(html('BUILD3'));
    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('NEVER reloads when the check itself fails', async () => {
    // Someone mid-transaction must not lose it to a network blip, and a reload loop is
    // worse than a stale tab.
    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as never;

    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads when the response is not ok', async () => {
    mockFetch('', false);

    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads when it cannot tell which bundle the server serves', async () => {
    mockFetch('<html><body>maintenance</body></html>');

    expect(await checkForStaleBuild('/assets/index-CLIENTOLD.js')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing when it cannot find its own bundle', async () => {
    const spy = mockFetch(html('SERVERNEW'));

    expect(await checkForStaleBuild(null)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('watchForStaleBuild: how quickly a stale tab is caught', () => {
  beforeEach(() => {
    // window.addEventListener is the seam: watchForStaleBuild registers focus,
    // pageshow and visibilitychange, and a fake-timer test cannot wait for the real
    // browser to deliver them.
    vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: any) => {
      watchForStaleBuildListeners.set(type, fn);
      return realAddEventListener(type, fn as any);
    }) as any);
    watchForStaleBuildListeners.clear();

    // watchForStaleBuild reads the bundle out of the document's own script tags, and
    // a jsdom document has none — so currentBundleHash() returns null and the check
    // exits before it ever fetches. Give the document the script the check is
    // meant to find, or every assertion here passes for the wrong reason.
    document.head.innerHTML = '<script type="module" src="/assets/index-CLIENTOLD.js"></script>';
  });

  /**
   * THE WINDOW THIS EXISTS TO CLOSE
   *
   * The first check used to be deferred by the full poll interval — sixty seconds.
   * In that minute a tab opened before a deploy serves the old bundle on every
   * click, and the old bundle is the one carrying the bug. So a fix that was
   * deployed and correct looked broken to the person most likely to be looking at
   * it, which is exactly how "it's happening again" gets reported after a fix that
   * demonstrably shipped.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    watchForStaleBuildListeners.clear();
    vi.restoreAllMocks();
  });

  // `advanceTimersByTimeAsync` rather than the sync version: the check awaits a
  // fetch, and a sync advance runs the timer callback without letting that promise
  // settle — so the assertions would pass or fail on the scheduler rather than on
  // the behaviour.
  it('checks within a couple of seconds, not a minute', async () => {
    mockFetch(html('SERVERNEW'));
    watchForStaleBuild();

    await vi.advanceTimersByTimeAsync(1_500);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the server is serving this tab the same build', async () => {
    // Same hash as the script the setup put in the document — CLIENTOLD.
    mockFetch(html('CLIENTOLD'));
    watchForStaleBuild();

    await vi.advanceTimersByTimeAsync(1_500);
    expect(reload).not.toHaveBeenCalled();
  });

  it('re-checks when a stale tab is restored from the back/forward cache', async () => {
    // A tab left open for a day comes back via pageshow. There is no focus event,
    // and a stale tab does not notice on its own — this is how it went unnoticed.
    mockFetch(html('SERVERNEW'));
    watchForStaleBuild();
    await vi.advanceTimersByTimeAsync(1_500);
    reload.mockClear();
    sessionStorage.clear();

    watchForStaleBuildListeners.get('pageshow')?.(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalled();
  });
});
