/**
 * jsdom shims for the browser APIs the chrome reaches for, mirroring
 * `packages/design-system/src/test-setup.ts`.
 *
 * The shell mounts the design system's `Sidebar`, `CommandDialog` and `Sheet`
 * primitives, which measure the viewport and listen on Pointer Events. jsdom
 * implements neither `ResizeObserver` nor pointer capture, and stubs
 * `scrollIntoView` away — without these, mounting `AppShell` throws before any
 * assertion is reached.
 *
 * Each shim is installed only where the environment has nothing, so a jsdom
 * that grows a real implementation keeps it.
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
