/**
 * jsdom shims for the browser APIs the Radix primitives underneath the builder
 * reach for.
 *
 * The field picker is a `Popover`, the operator cell a `Select`, the combinator
 * a `ToggleGroup`: between them they want `matchMedia`, `ResizeObserver`,
 * pointer capture and `scrollIntoView`, none of which jsdom implements. Without
 * these, mounting the builder throws before any assertion is reached — so the
 * seams these specs exist to pin would be untestable rather than untested.
 * Mirrors `packages/design-system/src/test-setup.ts`.
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
