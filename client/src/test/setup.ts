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
