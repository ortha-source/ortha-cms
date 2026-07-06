import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Languages } from 'lucide-react';
import { Spinner, cn } from '@ortha-cms/design-system';
import {
    getLocaleSwitch,
    subscribeLocaleSwitch,
    type LocaleSwitchVariant
} from '../../utils/localeTransition';
import { PageSkeleton } from './PageSkeleton';

const messages = defineMessages({
    switching: {
        id: 'i18n.switching.text',
        defaultMessage: 'Switching to {name}…'
    }
});

/** Fade-out duration — keep in sync with the `duration-300` class below. */
const FADE_MS = 300;

/**
 * The **locale-switch flourish** host: a brief, non-interactive full-screen
 * overlay — a `Languages` glyph, a spinner, and "Switching to <locale>…". It
 * reads the {@link beginLocaleSwitch} store, so it shows the moment a switch
 * begins, holds, then fades out. Rendered by both the toolbar switcher and the
 * editor's locale widget; whichever is mounted on the current route plays it,
 * which is what lets the flourish carry across a widget switch's navigation.
 *
 * The stale page is **hidden** behind a near-opaque backdrop and a shimmer
 * {@link PageSkeleton} of the approximate page (a records list or the entry
 * editor, per the switch's `variant`), with the switch indicator floating over
 * it — so the old content doesn't show through; the new content lands when the
 * overlay fades. Purely visual (`pointer-events-none`, `motion-reduce:animate-none`)
 * — the real data load stays the records view's / editor's job. Portalled to
 * `document.body` so it covers the whole viewport, clear of the toolbar.
 */
export function LocaleSwitchOverlay() {
    const intl = useIntl();
    const active = useSyncExternalStore(
        subscribeLocaleSwitch,
        getLocaleSwitch,
        () => null
    );
    // Mirror the store into local state so the exit can animate: when a switch
    // begins, show it immediately; when it clears, flip to `leaving` and drop
    // the overlay once the fade-out finishes.
    const [display, setDisplay] = useState<{
        name: string;
        variant: LocaleSwitchVariant;
        leaving: boolean;
    } | null>(null);

    useEffect(() => {
        if (active) {
            setDisplay({
                name: active.name,
                variant: active.variant,
                leaving: false
            });
        } else {
            setDisplay((current) =>
                current ? { ...current, leaving: true } : null
            );
        }
    }, [active]);

    useEffect(() => {
        if (!display?.leaving) return;
        const remove = setTimeout(() => setDisplay(null), FADE_MS);
        return () => clearTimeout(remove);
    }, [display?.leaving]);

    if (!display) return null;

    return createPortal(
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'pointer-events-none fixed inset-0 z-50 overflow-hidden bg-background/95 backdrop-blur-sm motion-reduce:animate-none',
                display.leaving
                    ? 'animate-out fade-out-0 fill-mode-forwards duration-300'
                    : 'animate-in fade-in-0 duration-200'
            )}
        >
            {/* The stale page is hidden behind a shimmer skeleton of the
                approximate page… */}
            <PageSkeleton variant={display.variant} />
            {/* …with the switch indicator floating over it. */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 rounded-xl border bg-background/80 px-8 py-6 shadow-sm backdrop-blur-sm">
                    <Languages
                        aria-hidden
                        className="size-12 text-muted-foreground"
                    />
                    <Spinner aria-hidden />
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.switching, {
                            name: display.name
                        })}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
}
