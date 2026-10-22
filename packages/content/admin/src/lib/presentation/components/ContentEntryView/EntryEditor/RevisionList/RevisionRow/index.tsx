import { defineMessages, useIntl } from 'react-intl';
import { Badge, cn } from '@orthacms/design-system';
import type {
    RevisionStatus,
    RevisionSummary
} from '../../../../../../domain/types/contentType';

const messages = defineMessages({
    version: { id: 'content.revisions.version', defaultMessage: 'v{n}' },
    saved: {
        id: 'content.revisions.savedVersion',
        defaultMessage: 'Saved version {n}'
    },
    live: { id: 'content.revisions.live', defaultMessage: 'Live' },
    draft: { id: 'content.revisions.draft', defaultMessage: 'Draft' },
    superseded: {
        id: 'content.revisions.superseded',
        defaultMessage: 'Superseded'
    },
    current: {
        id: 'content.revisions.currentDraft',
        defaultMessage: 'Current draft'
    },
    currentPlain: { id: 'content.revisions.current', defaultMessage: 'Current' }
});

/** Each revision state's label. */
export const REVISION_STATUS_LABEL: Record<
    RevisionStatus,
    (typeof messages)[keyof typeof messages]
> = {
    published: messages.live,
    draft: messages.draft,
    superseded: messages.superseded
};

/** Each revision state's badge tint: live green, a draft amber, past grey. */
export const REVISION_STATUS_VARIANT: Record<
    RevisionStatus,
    'success' | 'warning' | 'muted'
> = {
    published: 'success',
    draft: 'warning',
    superseded: 'muted'
};

/**
 * One **version** in the History timeline: its number as a small square badge
 * (green while it is the live one), when it was saved, and — on a publishable
 * type — its state. The whole row is a button that picks it for the
 * comparison beside the list; the actions on a version (Preview, Restore,
 * Publish this version) live in that comparison, so the list stays a list.
 *
 * Live / Draft / Superseded describe a publish workflow. On an always-live type
 * there isn't one — every version was simply saved — so the badge would label a
 * state the type doesn't have; "Current" still means something and stays.
 */
export function RevisionRow({
    revision,
    publishable,
    selected,
    onSelect
}: {
    revision: RevisionSummary;
    /** Whether the content type is publishable (else no state badge). */
    publishable: boolean;
    /** Whether this version is the one the comparison shows. */
    selected: boolean;
    onSelect: () => void;
}) {
    const intl = useIntl();
    const live = publishable && revision.isPublished;
    const time = intl.formatTime(revision.createdAt, {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] leading-[18px] transition-colors',
                'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'bg-muted hover:bg-muted'
            )}
        >
            <span className="flex w-[22px] shrink-0 justify-center pt-px">
                <span
                    className={cn(
                        'inline-flex h-5 min-w-6 items-center justify-center rounded-[5px] border bg-background px-[5px] text-[11px] font-semibold tabular-nums',
                        live &&
                            'border-transparent bg-success-soft text-success-soft-foreground'
                    )}
                >
                    {intl.formatMessage(messages.version, {
                        n: revision.number
                    })}
                </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">
                    {intl.formatMessage(messages.saved, { n: revision.number })}
                </span>
                <span className="text-xs text-muted-foreground">
                    <time dateTime={revision.createdAt}>{time}</time>
                    {revision.isLatest
                        ? ` · ${intl.formatMessage(
                              publishable
                                  ? messages.current
                                  : messages.currentPlain
                          )}`
                        : null}
                </span>
            </span>
            {publishable ? (
                <Badge
                    size="xs"
                    variant={REVISION_STATUS_VARIANT[revision.status]}
                >
                    {intl.formatMessage(REVISION_STATUS_LABEL[revision.status])}
                </Badge>
            ) : null}
        </button>
    );
}
