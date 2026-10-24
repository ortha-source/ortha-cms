import type { ComponentType, ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import { Skeleton, cn } from '@orthacms/design-system';

/** Intl descriptors for a Needs-attention line, co-located here. */
const messages = defineMessages({
    loading: {
        id: 'insights.signal.loading',
        defaultMessage: 'Loading {title}…'
    },
    error: {
        id: 'insights.signal.error',
        defaultMessage: "Couldn't load. Refresh to try again."
    },
    unavailable: {
        id: 'insights.signal.unavailable',
        defaultMessage: 'Unavailable'
    }
});

/**
 * What a line is asking for, as a **status** — never a data series. Each tone
 * is a soft fill behind the line's icon, so the state is carried by the icon
 * and the words as well as the hue.
 */
export type SignalTone = 'warn' | 'info' | 'bad';

/**
 * Whole literal class strings per tone — Tailwind scans source text and never
 * emits an interpolated class name (`[insights:I-21]`).
 */
const TONE_CLASS: Record<SignalTone, string> = {
    warn: 'bg-warning-soft text-warning-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
    bad: 'bg-destructive-soft text-destructive-soft-foreground'
};

/** Props for {@link SignalRow}. */
export type SignalRowProps = {
    /** The line's icon — the state survives for a reader who can't see hue. */
    icon: ComponentType<{ className?: string }>;
    /** The status the count asks for. */
    tone: SignalTone;
    /** The headline count. */
    count: number;
    /** What is being counted — "Waiting to go live". */
    title: ReactNode;
    /** The line under the title: what the count is compared against. */
    hint?: ReactNode;
    /** True while the line's query is in flight. */
    isPending?: boolean;
    /** True when it failed — the line says so instead of showing a count. */
    isError?: boolean;
    /** Opens the records behind the count. Handed to the signal by the page. */
    onOpen: () => void;
    /** Whether this line's panel is the one open. Handed over by the page. */
    isOpen: boolean;
};

/**
 * One line of the **Needs attention** card: an icon in its status tone, the
 * count, what it counts, and what it is compared against — and the whole line
 * is the button that opens the records behind it.
 *
 * The same three-way ladder as `WidgetCard`, for the same reason: a line that
 * could not load must never read as a zero. "0 waiting on review" tells a
 * reviewer they are free; "couldn't load" tells them to look. So the error
 * line has no count and no button — there is nothing behind it to open.
 */
export function SignalRow({
    icon: Icon,
    tone,
    count,
    title,
    hint,
    isPending = false,
    isError = false,
    onOpen,
    isOpen
}: SignalRowProps) {
    const intl = useIntl();
    const badge = (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-md',
                TONE_CLASS[tone]
            )}
        >
            <Icon className="size-4" />
        </span>
    );

    if (isPending) {
        return (
            <div
                role="status"
                className="flex items-center gap-3 px-4 py-3"
                data-testid="signal-skeleton"
            >
                <span className="sr-only">
                    {intl.formatMessage(messages.loading, { title })}
                </span>
                {badge}
                <Skeleton className="h-5 w-10" />
                <span className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                </span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center gap-3 px-4 py-3">
                {badge}
                <span
                    aria-hidden="true"
                    className="min-w-11 text-lg font-semibold tabular-nums"
                >
                    —
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                        <span className="sr-only">
                            {intl.formatMessage(messages.unavailable)}:{' '}
                        </span>
                        {title}
                    </span>
                    <span role="alert" className="text-xs text-destructive">
                        {intl.formatMessage(messages.error)}
                    </span>
                </span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors',
                'hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                isOpen && 'bg-muted'
            )}
        >
            {badge}
            <span className="min-w-11 text-lg font-semibold tabular-nums">
                {intl.formatNumber(count)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{title}</span>
                {hint ? (
                    <span className="text-xs text-muted-foreground">
                        {hint}
                    </span>
                ) : null}
            </span>
            <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
        </button>
    );
}
