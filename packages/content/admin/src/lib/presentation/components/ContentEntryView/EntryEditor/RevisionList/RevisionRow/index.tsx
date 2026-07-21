import { defineMessages, useIntl } from 'react-intl';
import { Badge, Button } from '@ortha-cms/design-system';
import type {
    RevisionStatus,
    RevisionSummary
} from '../../../../../../domain/types/contentType';

const messages = defineMessages({
    version: { id: 'content.revisions.version', defaultMessage: 'v{n}' },
    live: { id: 'content.revisions.live', defaultMessage: 'Live' },
    draft: { id: 'content.revisions.draft', defaultMessage: 'Draft' },
    superseded: {
        id: 'content.revisions.superseded',
        defaultMessage: 'Superseded'
    },
    current: { id: 'content.revisions.current', defaultMessage: 'Current' },
    restore: { id: 'content.revisions.restore', defaultMessage: 'Restore' },
    restoreLabel: {
        id: 'content.revisions.restoreLabel',
        defaultMessage: 'Restore version {n}'
    }
});

const STATUS_LABEL: Record<RevisionStatus, (typeof messages)[keyof typeof messages]> =
    {
        published: messages.live,
        draft: messages.draft,
        superseded: messages.superseded
    };

const STATUS_VARIANT: Record<RevisionStatus, 'success' | 'secondary' | 'outline'> =
    {
        published: 'success',
        draft: 'secondary',
        superseded: 'outline'
    };

/**
 * One revision in the timeline: its version number, a status badge (Live / Draft
 * / Superseded), the capture time, and — for a non-current version the user may
 * edit — a **Restore** action that re-applies it as a new revision. The newest
 * version is flagged `Current` and cannot restore onto itself.
 */
export function RevisionRow({
    revision,
    canUpdate,
    busy,
    onRestore
}: {
    revision: RevisionSummary;
    canUpdate: boolean;
    busy: boolean;
    onRestore: (number: number) => void;
}) {
    const intl = useIntl();
    const showRestore = canUpdate && !revision.isLatest;

    return (
        <div className="flex items-center gap-3 py-2">
            <span className="w-10 shrink-0 font-mono text-sm font-semibold tabular-nums">
                {intl.formatMessage(messages.version, { n: revision.number })}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[revision.status]}>
                        {intl.formatMessage(STATUS_LABEL[revision.status])}
                    </Badge>
                    {revision.isLatest && (
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.current)}
                        </span>
                    )}
                </div>
                <time
                    dateTime={revision.createdAt}
                    className="text-xs text-muted-foreground"
                >
                    {intl.formatDate(revision.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })}
                </time>
            </div>
            {showRestore && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={intl.formatMessage(messages.restoreLabel, {
                        n: revision.number
                    })}
                    onClick={() => onRestore(revision.number)}
                >
                    {intl.formatMessage(messages.restore)}
                </Button>
            )}
        </div>
    );
}
