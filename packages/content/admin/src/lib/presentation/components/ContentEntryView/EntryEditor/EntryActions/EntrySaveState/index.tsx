import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';

const messages = defineMessages({
    unsaved: {
        id: 'content.editor.saveState.unsaved',
        defaultMessage: 'Unsaved changes'
    },
    savedJustNow: {
        id: 'content.editor.saveState.savedJustNow',
        defaultMessage: 'Saved just now'
    },
    savedAgo: {
        id: 'content.editor.saveState.savedAgo',
        defaultMessage: 'Saved {ago}'
    }
});

/** How often the "Saved … ago" sentence is re-read, in milliseconds. */
const TICK_MS = 30_000;

/** The largest unit that fits, for `Intl.RelativeTimeFormat`. */
function relative(
    elapsedSeconds: number
): [number, Intl.RelativeTimeFormatUnit] {
    const minutes = Math.round(elapsedSeconds / 60);
    if (minutes < 60) return [-minutes, 'minute'];
    const hours = Math.round(minutes / 60);
    if (hours < 24) return [-hours, 'hour'];
    return [-Math.round(hours / 24), 'day'];
}

/**
 * The editor's **save state**, said in words beside its buttons: "Unsaved
 * changes" while the form holds anything a Save would write, else when the
 * record was last saved.
 *
 * It is the other half of the action matrix. The buttons say what a click
 * will do — or, with nothing to do, show their state disabled — and this says
 * where the record stands, so a clean editor never has to be inferred from a
 * greyed-out button.
 *
 * Not a live region: it changes on every keystroke that dirties the form, and
 * announcing that would talk over the person typing. The save toast is what
 * reports a save.
 */
export function EntrySaveState({
    dirty,
    isCreate,
    updatedAt,
    className
}: {
    /** Whether a Save would write anything. */
    dirty: boolean;
    /** A create form — nothing has been saved, so there is no time to give. */
    isCreate: boolean;
    /** The stored record's last-updated time (ISO). */
    updatedAt?: string;
    className?: string;
}) {
    const intl = useIntl();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (dirty || isCreate || !updatedAt) return;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
        return () => window.clearInterval(timer);
    }, [dirty, isCreate, updatedAt]);

    if (dirty) {
        return (
            <span
                data-testid="entry-save-state"
                className={cn(
                    'flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-warning-soft-foreground',
                    className
                )}
            >
                <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-current"
                />
                {intl.formatMessage(messages.unsaved)}
            </span>
        );
    }

    if (isCreate || !updatedAt) return null;
    const saved = Date.parse(updatedAt);
    if (Number.isNaN(saved)) return null;
    const elapsed = Math.max(0, (now - saved) / 1000);

    return (
        <span
            data-testid="entry-save-state"
            className={cn(
                'shrink-0 text-xs whitespace-nowrap text-muted-foreground',
                className
            )}
        >
            {elapsed < 60
                ? intl.formatMessage(messages.savedJustNow)
                : intl.formatMessage(messages.savedAgo, {
                      ago: intl.formatRelativeTime(...relative(elapsed), {
                          numeric: 'auto'
                      })
                  })}
        </span>
    );
}
