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

/** Which page the switch happens on — picks the overlay's skeleton shape. */
export type LocaleSwitchVariant = 'list' | 'editor';

/** The active switch — a **stable** object (set once per begin) so the
 * `useSyncExternalStore` snapshot stays referentially stable between changes. */
export type LocaleSwitch = { name: string; variant: LocaleSwitchVariant };

/** How long the overlay holds before it auto-dismisses (then fades out). */
const HOLD_MS = 300;

let active: LocaleSwitch | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener();
}

/**
 * Begin (or restart) the switch flourish for the locale named `name`. `variant`
 * chooses the overlay's skeleton (a records list vs the entry editor).
 */
export function beginLocaleSwitch(
    name: string,
    variant: LocaleSwitchVariant = 'list'
) {
    active = { name, variant };
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
        active = null;
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

/** The active switch (name + variant), or `null` when idle. */
export function getLocaleSwitch(): LocaleSwitch | null {
    return active;
}
