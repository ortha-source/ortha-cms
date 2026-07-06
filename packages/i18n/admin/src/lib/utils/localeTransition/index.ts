/**
 * A tiny module-level store for the **locale-switch transition flourish**. A
 * switch trigger (the toolbar switcher, the editor's locale widget) calls
 * {@link beginLocaleSwitch}; the `LocaleSwitchOverlay` host — rendered by
 * whichever of those is mounted on the current route — reads it via
 * `useSyncExternalStore` and plays the overlay.
 *
 * It's module-level (not React state) on purpose: a widget switch **navigates**
 * to a sibling's editor, unmounting the trigger, so the transition has to
 * outlive that and be re-read by a fresh overlay host on the destination. The
 * flourish is purely presentational — a fixed {@link HOLD_MS} hold, not tied to
 * the data load (the records view / editor own the real pending state).
 */

type Listener = () => void;

/** How long the overlay holds before it auto-dismisses (then fades out). */
const HOLD_MS = 300;

let activeName: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener();
}

/** Begin (or restart) the switch flourish for the locale named `name`. */
export function beginLocaleSwitch(name: string) {
    activeName = name;
    if (clearTimer) clearTimeout(clearTimer);
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
