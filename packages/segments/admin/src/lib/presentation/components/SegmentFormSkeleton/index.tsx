import { defineMessages, useIntl } from 'react-intl';
import { Skeleton } from '@orthacms/design-system';

const messages = defineMessages({
    loading: {
        id: 'segments.form.skeleton.loading',
        defaultMessage: 'Loading the audience…'
    }
});

/**
 * The audience editor's body while it loads — the form card (a label/control
 * pair per field, then the two "Offered in" cards) beside the side panel.
 *
 * A **skeleton rather than a spinner**: a form's shape is most of what a reader
 * needs to know before it arrives, and a centred spinner tells them none of it
 * while moving every control once it resolves.
 *
 * Two consumers, hence the top of `components/`: the route's lazy-chunk fallback
 * ({@link SegmentEditorPageSkeleton}) and the edit page's own pending state,
 * where the header above it is already real.
 */
export function SegmentFormSkeleton() {
    const intl = useIntl();

    return (
        <div role="status" className="mt-6 max-w-[940px]">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div
                aria-hidden
                className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
            >
                <div className="flex flex-col gap-4 rounded-xl border p-4">
                    {[
                        'h-9',
                        'h-9',
                        // The reader-tags chips sit in a box that wraps.
                        'h-11'
                    ].map((height, field) => (
                        <div key={field} className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className={`${height} w-full`} />
                            <Skeleton className="h-3 w-64 max-w-full" />
                        </div>
                    ))}
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-28" />
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-3 rounded-xl border p-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            </div>
        </div>
    );
}
