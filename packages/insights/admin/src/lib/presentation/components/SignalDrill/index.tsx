import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Skeleton
} from '@orthacms/design-system';

/** Intl descriptors for the drill-down shell, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'insights.drill.heading',
        defaultMessage:
            '{title} · {count, number} {count, plural, one {record} other {records}}'
    },
    loading: {
        id: 'insights.drill.loading',
        defaultMessage: 'Loading the records…'
    },
    error: {
        id: 'insights.drill.error',
        defaultMessage: "These records didn't load. Close and try again."
    },
    empty: {
        id: 'insights.drill.empty',
        defaultMessage: 'Nothing here right now.'
    },
    more: {
        id: 'insights.drill.more',
        defaultMessage:
            'Showing the oldest {shown, number} of {total, number}.'
    }
});

/** Props for {@link SignalDrill}. */
export type SignalDrillProps = {
    /** The signal's name — "Gone quiet". */
    title: string;
    /**
     * The true number of records behind the line. Omitted while unknown, and
     * the heading then names the signal alone rather than inventing a zero.
     */
    count?: number;
    /** How many rows are listed, when fewer than `count`. */
    shown?: number;
    /** One sentence for assistive tech saying what the list is. */
    description: string;
    /** A control above the list — e.g. the age bands of "Gone quiet". */
    filter?: ReactNode;
    /** True while the records' query is in flight. */
    isPending?: boolean;
    /** True when it failed. Takes precedence over `isEmpty`. */
    isError?: boolean;
    /** True when it loaded and nothing matches. */
    isEmpty?: boolean;
    /** Overrides the shared empty copy. */
    emptyMessage?: ReactNode;
    /** The way out to the full list — "Open all 112 in Records". */
    actions?: ReactNode;
    /** The rows: `DrillRecordRow`s. */
    children?: ReactNode;
};

/**
 * The body of a Needs-attention drill-down: the panel's heading, an optional
 * filter, the records behind the count (oldest first, by the contributing
 * read's contract) and the way out to the full list.
 *
 * It owns the same **four-branch ladder** as `WidgetCard`, and for the same
 * reason: an empty panel and a failed one must never look alike — "nothing is
 * waiting" and "we couldn't ask" mean opposite things to the person who
 * clicked the line.
 *
 * Rendered inside the page's sheet, so the heading is the dialog's own title.
 */
export function SignalDrill({
    title,
    count,
    shown,
    description,
    filter,
    isPending = false,
    isError = false,
    isEmpty = false,
    emptyMessage,
    actions,
    children
}: SignalDrillProps) {
    const intl = useIntl();
    const heading =
        count === undefined
            ? title
            : intl.formatMessage(messages.heading, { title, count });

    return (
        <>
            <SheetHeader className="space-y-0 border-b px-5 py-4 pr-12 text-left">
                <SheetTitle className="text-[15px] leading-5">
                    {heading}
                </SheetTitle>
                <SheetDescription className="sr-only">
                    {description}
                </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
                {filter}
                {isPending ? (
                    <div
                        role="status"
                        className="flex flex-col gap-2"
                        data-testid="drill-skeleton"
                    >
                        <span className="sr-only">
                            {intl.formatMessage(messages.loading)}
                        </span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <Skeleton key={index} className="h-12 w-full" />
                        ))}
                    </div>
                ) : isError ? (
                    <p
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-4 text-sm text-destructive"
                    >
                        {intl.formatMessage(messages.error)}
                    </p>
                ) : isEmpty ? (
                    <p
                        role="status"
                        className="py-4 text-sm text-muted-foreground"
                    >
                        {emptyMessage ?? intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <>
                        <ul className="divide-y overflow-hidden rounded-xl border">
                            {children}
                        </ul>
                        {count !== undefined &&
                        shown !== undefined &&
                        shown < count ? (
                            <p className="text-xs text-muted-foreground">
                                {intl.formatMessage(messages.more, {
                                    shown,
                                    total: count
                                })}
                            </p>
                        ) : null}
                        {actions ? (
                            <div className="flex flex-wrap gap-2">
                                {actions}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </>
    );
}
