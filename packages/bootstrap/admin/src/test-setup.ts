/**
 * jsdom shims for the browser APIs `createAdmin`'s provider stack reaches for.
 *
 * The host mounts `AppearanceProvider` (which reads `matchMedia`) and the
 * design-system's Radix/sonner primitives (which listen on Pointer Events and
 * observe resizes). jsdom implements none of them, so the tree throws on mount
 * and the diagnostics these specs exist to pin would be untestable rather than
 * untested. Same list as `packages/design-system/src/test-setup.ts`.
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
