import { useEffect, useRef } from 'react';
import {
    PUBLISH_SHORTCUT_KEY,
    SAVE_SHORTCUT_KEY
} from '../../../domain/constants';

/** What each of the editor's chords runs, or `null` when it can't run now. */
export type EntryShortcutHandlers = {
    /** ⌘S / Ctrl+S — Save draft, or a plain Save. */
    onSave: (() => void) | null;
    /** ⌘⇧P / Ctrl+Shift+P — Publish / Publish changes. */
    onPublish: (() => void) | null;
};

/**
 * Whether a **modal** surface currently owns the keyboard. A chord pressed in a
 * confirmation dialog belongs to that dialog — saving the record underneath a
 * "Delete this entry?" prompt is the last thing the person meant.
 *
 * Radix marks a modal by locking the body's scroll (`data-scroll-locked`), and
 * an alert dialog by its role; a non-modal panel (the Details panel over the
 * form) does neither, so the chords keep working while it is open.
 */
function modalOpen(): boolean {
    if (typeof document === 'undefined') return false;
    return (
        document.body.hasAttribute('data-scroll-locked') ||
        document.querySelector('[role="alertdialog"]') !== null
    );
}

/**
 * Binds the entry editor's keyboard chords: **⌘S** saves and **⌘⇧P**
 * publishes, on macOS and as Ctrl on every other platform — the handler takes
 * either modifier, as the ⌘K search chord does.
 *
 * ⌘S is always taken while the editor is mounted, even when nothing can be
 * saved: the browser's own "Save page as…" dialog is never what a person
 * pressing it inside a form wants. ⌘⇧P is only taken when it does something,
 * so the browser's private-window chord keeps working elsewhere.
 *
 * The handlers are read through a ref, so a re-render with new closures never
 * re-binds the listener.
 */
export function useEntryShortcuts(
    handlers: EntryShortcutHandlers,
    enabled = true
): void {
    const ref = useRef(handlers);
    ref.current = handlers;

    useEffect(() => {
        if (!enabled) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === SAVE_SHORTCUT_KEY && !event.shiftKey) {
                event.preventDefault();
                if (modalOpen()) return;
                ref.current.onSave?.();
                return;
            }
            if (key === PUBLISH_SHORTCUT_KEY && event.shiftKey) {
                const publish = ref.current.onPublish;
                if (!publish || modalOpen()) return;
                event.preventDefault();
                publish();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled]);
}
