/**
 * jsdom shims for the browser APIs the Radix/cmdk/sonner primitives reach for.
 *
 * jsdom implements neither `matchMedia`, `ResizeObserver`, nor the Pointer
 * Events the Radix presence/dismissable layers listen on, and it stubs
 * `scrollIntoView` away entirely. Without these, mounting anything built on
 * `Popover`, `Command` or `Sheet` throws before the assertion is reached — so
 * the seams these specs exist to pin would be untestable rather than untested.
 */

if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
}

if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
}
