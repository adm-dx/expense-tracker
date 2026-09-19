import '@testing-library/jest-dom';

// Files with `@jest-environment node` (e.g. the HTTP client) share this setup
// but have no DOM, so the polyfills below must be skipped for them.
const hasDom = typeof window !== 'undefined';

if (hasDom) {
  // jsdom lacks a few DOM APIs that Radix primitives (Select, Dialog) rely on.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      ResizeObserverStub;
  }
}
