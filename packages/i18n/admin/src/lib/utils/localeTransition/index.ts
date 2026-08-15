/**
 * A tiny module-level store for the **locale-switch transition flourish**. A
 * switch trigger (the toolbar switcher, the editor's locale widget) calls
 * {@link beginLocaleSwitch} with the locale name **and** the actual swap to
 * perform (`updateParams` / `navigate`); the `LocaleSwitchOverlay` host —
 * rendered by whichever of those is mounted on the current route — reads the
 * name via `useSyncExternalStore` and plays the overlay.
 *
 * It's module-level (not React state) on purpose: a widget switch **navigates**
 * to a sibling's editor, unmounting the trigger, so the transition has to
 * outlive that and be re-read by a fresh overlay host on the destination.
 *
 * The swap is **deferred** ({@link COVER_MS}) so it runs only once the overlay
 * has faded in and covers the page — the layout change happens *behind* the
 * cover instead of flashing the new locale's content under a translucent
 * overlay.
 *
 * The overlay then holds for at least {@link MIN_HOLD_MS} and — crucially —
 * **until the destination has finished loading**, which the host reports by
 * calling {@link settleLocaleSwitch}. It used to clear on a fixed timer instead,
 * which meant switching to a locale whose record wasn't cached uncovered the
 * editor mid-fetch: the editor swaps to its own full-page spinner while the
 * cover is still fading, so you saw a spinner appear *behind* the overlay's
 * spinner and the two blink in sequence. {@link MAX_HOLD_MS} caps the wait so a
 * hung request can never leave the page covered.
 */

type Listener = () => void;

/** Delay before the real swap runs — long enough for the overlay to cover. */
const COVER_MS = 220;

/**
 * The floor on how long the overlay stays up. Also the window in which a "no
 * requests in flight" reading is ignored: right after the swap the destination's
 * queries haven't been issued yet, so quiet doesn't mean ready.
 */
const MIN_HOLD_MS = 380;

/** Ceiling on the hold, so a stalled request can't leave the page covered. */
const MAX_HOLD_MS = 5000;

let activeName: string | null = null;
let startedAt = 0;
let maxTimer: ReturnType<typeof setTimeout> | undefined;
let applyTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener();
}

function clear() {
    activeName = null;
    if (maxTimer) clearTimeout(maxTimer);
    maxTimer = undefined;
    emit();
}

/**
 * Begin (or restart) the switch flourish for the locale named `name`, running
 * `apply` (the URL/nav swap) only once the overlay covers the page. A rapid
 * re-switch cancels any pending `apply`/timeout so the last pick wins.
 */
export function beginLocaleSwitch(name: string, apply: () => void) {
    activeName = name;
    startedAt = Date.now();
    if (maxTimer) clearTimeout(maxTimer);
    if (applyTimer) clearTimeout(applyTimer);
    // Show the overlay first (emit below), then swap behind it. The clear is the
    // host's call (see `settleLocaleSwitch`); this is only the backstop.
    applyTimer = setTimeout(() => {
        applyTimer = undefined;
        apply();
    }, COVER_MS);
    maxTimer = setTimeout(clear, MAX_HOLD_MS);
    emit();
}

/**
 * Cancel a switch whose swap has **not run yet**, and lift the cover with it.
 *
 * Called by a trigger when it unmounts. Between `beginLocaleSwitch` and
 * {@link COVER_MS} the swap is only a scheduled `navigate`/`updateParams`; if
 * the user leaves in that window — clicking any other link, since the cover is
 * `pointer-events-none` — the timer used to fire anyway and yank them onto the
 * locale they had abandoned, from a component that no longer exists.
 *
 * Deliberately a **no-op once the swap has run**: from that moment the flourish
 * is legitimately in flight and has to outlive the trigger's unmount, which is
 * the entire reason the store is module-level (a widget switch navigates away
 * from the widget that started it).
 */
export function cancelPendingLocaleSwitch() {
    if (!applyTimer) return;
    clearTimeout(applyTimer);
    applyTimer = undefined;
    clear();
}

/**
 * Report that the destination has settled — no requests in flight. Ends the
 * flourish, but not before {@link MIN_HOLD_MS} has passed: the host polls this
 * as queries come and go, and the first reading (before the destination's
 * queries are even issued) would otherwise end it instantly.
 *
 * Returns whether it ended, so a caller can re-check after the floor elapses.
 */
export function settleLocaleSwitch(): boolean {
    if (!activeName) return false;
    if (Date.now() - startedAt < MIN_HOLD_MS) return false;
    clear();
    return true;
}

/** How long the flourish has been running, for a host scheduling its re-check. */
export const LOCALE_SWITCH_MIN_HOLD_MS = MIN_HOLD_MS;

/** Subscribe to store changes — the `subscribe` arg of `useSyncExternalStore`. */
export function subscribeLocaleSwitch(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The locale name currently being switched to, or `null` when idle. */
export function getLocaleSwitch(): string | null {
    return activeName;
}
