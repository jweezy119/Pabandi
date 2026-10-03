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
