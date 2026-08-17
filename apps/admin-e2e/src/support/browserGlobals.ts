/**
 * Minimal hand-typed shapes for the browser globals a `page.evaluate` body
 * touches.
 *
 * This project's tsconfig ships **no DOM lib** — the specs drive a browser,
 * they do not compile against one — so `document`, `navigator` and friends are
 * unknown names at compile time. `reflow.spec.ts` and `settings.spec.ts` each
 * cast `globalThis` inline for this reason; these aliases are the same trick
 * with the shape written once.
 *
 * They are **types only**, which is what makes them usable inside an `evaluate`
 * callback: a type annotation is erased before the function is serialized and
 * shipped to the page, so nothing here becomes a closure the browser cannot
 * resolve. Never export a *value* from this file for that reason.
 */

/** An element, as far as any assertion here needs to know. */
export interface EvalElement {
    tagName: string;
    className: string;
    scrollWidth: number;
    clientWidth: number;
    textContent: string | null;
    getAttribute(name: string): string | null;
    parentElement: EvalElement | null;
    querySelector(selector: string): EvalElement | null;
}

/**
 * The scroll geometry of a scrollable element, for a `locator.evaluate` body.
 *
 * `Locator.evaluate` hands its callback `SVGElement | HTMLElement`, and the
 * scroll properties live only on the `HTMLElement` branch — so reading one
 * straight off the parameter does not compile. Widening through this shape says
 * what the assertion actually needs instead of asserting a DOM class this
 * project has no lib for.
 */
export interface EvalScrollable {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

/**
 * `navigator`, with the two platform hints a keyboard-shortcut glyph is judged
 * on. The index signature is what keeps it assignable where a bare bag of
 * properties is wanted (`ApiTokensPage` redefines `clipboard` on it).
 */
export interface EvalNavigator {
    [key: string]: unknown;
    platform?: string;
    userAgentData?: { platform?: string };
}

/** An `<input>`, with the bits a one-time-secret field is judged on. */
export interface EvalInput extends EvalElement {
    value: string;
    selectionStart: number | null;
    selectionEnd: number | null;
}

/** A `Storage` (local/session), keyed access only. */
export interface EvalStorage {
    getItem(key: string): string | null;
}

/**
 * A React fiber node, opaque apart from the two links used to walk it. The walk
 * exists to reach the app's TanStack `QueryClient`, which nothing else exposes.
 */
export interface EvalFiber {
    [key: string]: unknown;
    child?: EvalFiber | null;
    sibling?: EvalFiber | null;
}

/** A TanStack cache, reduced to the enumeration a leak check needs. */
export interface EvalCache {
    getAll(): { state: unknown }[];
}

/** The app's `QueryClient`, as reached through the fiber tree. */
export interface EvalQueryClient {
    getQueryCache(): EvalCache;
    getMutationCache(): EvalCache;
}

/** The globals an `evaluate` body reaches for, hung off `globalThis`. */
export interface BrowserGlobals {
    document: {
        activeElement: EvalElement | null;
        body: EvalElement;
        documentElement: EvalElement & { innerHTML: string };
        getElementById(id: string): (EvalElement & EvalFiber) | null;
        querySelector(selector: string): EvalElement | null;
    };
    window: { innerWidth: number };
    location: { href: string };
    localStorage: EvalStorage;
    sessionStorage: EvalStorage;
    navigator: EvalNavigator;
    getComputedStyle(element: EvalElement): { overflowX: string };
}
