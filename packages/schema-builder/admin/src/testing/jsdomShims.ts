/**
 * The browser APIs Radix's dialogs, sheets, selects and menus reach for that
 * jsdom does not implement. Imported by the specs that open one.
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

const proto = Element.prototype as unknown as Record<string, unknown>;
proto['hasPointerCapture'] ??= () => false;
proto['releasePointerCapture'] ??= () => undefined;
proto['scrollIntoView'] ??= () => undefined;

export {};
