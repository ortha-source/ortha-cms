/**
 * The browser APIs jsdom lacks and the Radix primitives reach for, installed
 * by the component specs that render a dialog or a menu. Mirrors the shims the
 * design system's own suite installs.
 */
export function installDomShims(): void {
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
    }
}
