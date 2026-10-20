import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Rocket, Save } from 'lucide-react';
import { Spinner } from '@orthacms/design-system';

/** Which write the editor is running — picks the glyph and the copy. */
export const ENTRY_BUSY = {
    Saving: 'saving',
    Publishing: 'publishing',
    /**
     * The server asked before a save that reaches other rows, and the
     * question is on screen. The cover stays up — blur only, nothing
     * announced — so the asking request, the dialog and the confirmed resend
     * read as one write instead of a cover that lifts, a dialog, and a cover
     * again.
     */
    Confirming: 'confirming'
} as const;

/** @see ENTRY_BUSY */
export type EntryBusy = (typeof ENTRY_BUSY)[keyof typeof ENTRY_BUSY];

const messages = defineMessages({
    saving: { id: 'content.entry.savingOverlay', defaultMessage: 'Saving…' },
    publishing: {
        id: 'content.entry.publishingOverlay',
        defaultMessage: 'Publishing…'
    }
});

/**
 * The **save / publish cover**: a non-interactive full-screen blur shown while a
 * write to the open entry is running, mirroring the locale-switch flourish so
 * the two read as the same app.
 *
 * Two deliberate differences from that one. It appears **with no delay** — the
 * locale overlay defers its swap so the layout change happens behind the cover,
 * but here nothing changes until the server answers, so there is nothing to hide
 * and any delay would just be lag between the click and the feedback. And it is
 * **not timed**: it stays up for as long as the write actually takes, refetches
 * included (the caller holds it across the whole flow), so it never lifts onto a
 * screen still showing pre-save values.
 *
 * Purely visual — `pointer-events-none` blocks nothing on its own; the editor
 * already disables its own controls while saving. `role="status"` +
 * `aria-live="polite"` announces the state to screen readers, which is the part
 * a blur alone conveys only to sighted users.
 *
 * While {@link ENTRY_BUSY.Confirming} it is only the blur: the sync dialog sits
 * on top and is what the person reads, and a spinner under it would claim a
 * write is running while the app waits on them. It enters without the fade —
 * it replaces a cover that was already up — and one layer lower (`z-40`), so
 * the dialog's own `z-50` layer is above it whichever of the two portals the
 * commit appends to `<body>` last.
 */
export function EntryBusyOverlay({ busy }: { busy: EntryBusy | null }) {
    const intl = useIntl();
    if (!busy) return null;
    if (busy === ENTRY_BUSY.Confirming) {
        return createPortal(
            <div
                aria-hidden
                data-testid="entry-busy-held"
                className="pointer-events-none fixed inset-0 z-40 bg-background/95 backdrop-blur-sm"
            />,
            document.body
        );
    }
    const publishing = busy === ENTRY_BUSY.Publishing;
    const Glyph = publishing ? Rocket : Save;

    return createPortal(
        <div
            role="status"
            aria-live="polite"
            data-testid="entry-busy"
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in-0 duration-150 motion-reduce:animate-none"
        >
            <div className="flex flex-col items-center gap-3">
                <Glyph aria-hidden className="size-12 text-muted-foreground" />
                <Spinner aria-hidden />
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(
                        publishing ? messages.publishing : messages.saving
                    )}
                </p>
            </div>
        </div>,
        document.body
    );
}
