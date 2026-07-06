import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Languages } from 'lucide-react';
import { Spinner, cn } from '@ortha-cms/design-system';

const messages = defineMessages({
    switching: {
        id: 'i18n.switching.text',
        defaultMessage: 'Switching to {name}…'
    }
});

/** A short beat before the overlay eases in, so it doesn't pop in instantly. */
const SHOW_DELAY_MS = 150;
/** How long the overlay holds at full opacity before it starts fading out. */
const HOLD_MS = 550;
/** Fade-out duration — keep in sync with the `duration-300` class below. */
const FADE_MS = 300;

/**
 * A brief, non-interactive full-screen flourish shown while the active locale
 * changes: a `Languages` glyph, a spinner, and "Switching to <locale>…". Waits a
 * short beat (so it doesn't pop in instantly), fades in, holds, then fades out
 * and calls `onDone` so the parent can unmount it.
 *
 * Purely visual (`pointer-events-none`, `motion-reduce:animate-none`) — the real
 * data load is the records view's job; this only marks the transition. Portalled
 * to `document.body` so it covers the whole viewport, clear of the toolbar.
 */
export function LocaleSwitchOverlay({
    localeName,
    onDone
}: {
    /** Display name of the locale being switched to (shown in the text). */
    localeName: string;
    /** Called once the fade-out finishes so the parent can drop the overlay. */
    onDone: () => void;
}) {
    const intl = useIntl();
    // `shown` gates the small pre-delay; `leaving` swaps fade-in for fade-out.
    const [shown, setShown] = useState(false);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        const show = setTimeout(() => setShown(true), SHOW_DELAY_MS);
        return () => clearTimeout(show);
    }, []);

    useEffect(() => {
        if (!shown) return;
        const hold = setTimeout(() => setLeaving(true), HOLD_MS);
        const done = setTimeout(onDone, HOLD_MS + FADE_MS);
        return () => {
            clearTimeout(hold);
            clearTimeout(done);
        };
    }, [shown, onDone]);

    // Truly absent during the pre-delay — nothing renders until the beat passes.
    if (!shown) return null;

    return createPortal(
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm motion-reduce:animate-none',
                leaving
                    ? 'animate-out fade-out-0 fill-mode-forwards duration-300'
                    : 'animate-in fade-in-0 duration-200'
            )}
        >
            <div className="flex flex-col items-center gap-3">
                <Languages
                    aria-hidden
                    className="size-12 text-muted-foreground"
                />
                <Spinner aria-hidden />
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.switching, {
                        name: localeName
                    })}
                </p>
            </div>
        </div>,
        document.body
    );
}
