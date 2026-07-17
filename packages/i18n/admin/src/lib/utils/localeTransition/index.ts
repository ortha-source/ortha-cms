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
 * overlay. The overlay then holds ({@link HOLD_MS}) and fades out to reveal the
 * swapped content. Purely presentational timing — not tied to the data load
 * (the records view / editor own the real pending state).
 */

type Listener = () => void;

/** Delay before the real swap runs — long enough for the overlay to cover. */
const COVER_MS = 220;

/** How long the overlay holds (after the swap) before it fades out. */
const HOLD_MS = 380;

let activeName: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
let applyTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener();
}

/**
 * Begin (or restart) the switch flourish for the locale named `name`, running
 * `apply` (the URL/nav swap) only once the overlay covers the page. A rapid
 * re-switch cancels any pending `apply`/clear so the last pick wins.
 */
export function beginLocaleSwitch(name: string, apply: () => void) {
    activeName = name;
    if (clearTimer) clearTimeout(clearTimer);
    if (applyTimer) clearTimeout(applyTimer);
    // Show the overlay first (emit below), then swap behind it, then clear.
    applyTimer = setTimeout(() => {
        applyTimer = undefined;
        apply();
    }, COVER_MS);
    clearTimer = setTimeout(() => {
        activeName = null;
        clearTimer = undefined;
        emit();
    }, HOLD_MS);
    emit();
}

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
