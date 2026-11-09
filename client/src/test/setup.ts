// Test setup.
//
// jsdom does not implement matchMedia, and Material-UI's useMediaQuery — which
// Layout and several page shells call — throws on a missing implementation rather
// than returning false. Without this the suite fails at import time, which reads as a
// broken test runner instead of a missing browser API.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// LandingPage has an IntersectionObserver in an effect, so rendering the app at
// its landing route — clicking through the nav, say — throws at import time
// rather than returning no elements. Same reason matchMedia is stubbed above.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverStub;
}

/**
 * Node 26 ships an experimental global `localStorage` accessor that returns
 * `undefined` unless the process was started with `--localstorage-file`. In the
 * jsdom environment that accessor shadows jsdom's own storage, so every
 * `localStorage.clear()` and `setItem()` in the suite threw before a single
 * assertion ran — 19 tests were failing with
 * "Cannot read properties of undefined (reading 'setItem')".
 *
 * Guarded on storage actually being missing, so a Node or jsdom that provides a
 * working implementation keeps it.
 */
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const backing = new Map<string, string>();

  const memoryStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => (backing.has(key) ? (backing.get(key) as string) : null),
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key);
    },
    setItem: (key: string, value: string) => {
      backing.set(key, String(value));
    },
  };

  const install = (target: object) =>
    Object.defineProperty(target, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });

  install(window);
  // The bare `localStorage` identifier resolves against globalThis, which is a
  // distinct object from `window` in this environment.
  install(globalThis);
}
