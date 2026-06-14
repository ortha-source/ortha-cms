/**
 * Generate a stable client-side id for a tree node. Used for React
 * keys; never serialised. `crypto.randomUUID` is universally available
 * in modern browsers; the `Math.random` fallback exists only so legacy
 * runtimes (and the occasional jsdom build without the WebCrypto
 * polyfill) don't blow up.
 */
export function newId(): string {
    if (
        typeof globalThis.crypto !== 'undefined' &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return globalThis.crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
}
