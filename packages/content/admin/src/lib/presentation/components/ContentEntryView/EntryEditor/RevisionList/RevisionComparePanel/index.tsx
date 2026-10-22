import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner, cn } from '@orthacms/design-system';
import type {
    ContentTypeDetail,
    RevisionSummary
} from '../../../../../../domain/types/contentType';
import {
    countChanges,
    diffRevision
} from '../../../../../../domain/revisionDiff';
import { useRevisionDetail } from '../../../../../../application/useRevisionDetail';
import { RevisionCompareRow } from './RevisionCompareRow';

const messages = defineMessages({
    version: { id: 'content.revisions.version', defaultMessage: 'v{n}' },
    compared: {
        id: 'content.revisions.comparedWithCurrent',
        defaultMessage: 'Compared with the current draft'
    },
    current: {
        id: 'content.revisions.isCurrent',
        defaultMessage: 'This is the current draft'
    },
    currentBody: {
        id: 'content.revisions.isCurrentBody',
        defaultMessage:
            'Every earlier version is compared with it. Pick one in the list to see what changed since.'
    },
    differ: {
        id: 'content.revisions.fieldsDiffer',
        defaultMessage:
            '{count, plural, =0 {Identical to the current draft} one {# field differs} other {# fields differ}}'
    },
    loading: {
        id: 'content.revisions.compareLoading',
        defaultMessage: 'Loading the comparison…'
    },
    error: {
        id: 'content.revisions.compareError',
        defaultMessage: 'The comparison could not be loaded.'
    },
    preview: { id: 'content.revisions.preview', defaultMessage: 'Preview' },
    previewLabel: {
        id: 'content.revisions.previewLabel',
        defaultMessage: 'Preview version {n}'
    },
    restore: { id: 'content.revisions.restore', defaultMessage: 'Restore' },
    restoreLabel: {
        id: 'content.revisions.restoreLabel',
        defaultMessage: 'Restore version {n}'
    },
    publish: {
        id: 'content.revisions.publishThis',
        defaultMessage: 'Publish this version'
    },
    publishLabel: {
        id: 'content.revisions.publishLabel',
        defaultMessage: 'Publish version {n}'
    }
});

/**
 * The selected version beside the History list: what changed between it and
 * the current draft, field by field, with the three things that can be done
 * with it — **Preview** (the full compare, unchanged fields included),
 * **Restore**, and **Publish this version**. They used to be buttons on every
 * row; one version at a time, next to its own changes, is where the decision
 * is made.
 *
 * The newest version *is* the current draft, so it has nothing to compare: it
 * says so, and offers only Publish while it is not live.
 */
export function RevisionComparePanel({
    typeName,
    entryId,
    schema,
    revision,
    latestNumber,
    canRestore,
    canPublish,
    busy,
    onPreview,
    onRestore,
    onPublish
}: {
    typeName: string;
    entryId: string;
    schema: ContentTypeDetail;
    revision: RevisionSummary;
    /** The newest version's number — the comparison's baseline. */
    latestNumber: number;
    canRestore: boolean;
    /** Publishable type + `content:publish`. */
    canPublish: boolean;
    busy: boolean;
    onPreview: () => void;
    onRestore: () => void;
    onPublish: () => void;
}) {
    const intl = useIntl();
    const isCurrent = revision.isLatest;
    const selected = useRevisionDetail(
        typeName,
        isCurrent ? undefined : entryId,
        isCurrent ? undefined : revision.number
    );
    const latest = useRevisionDetail(
        typeName,
        isCurrent ? undefined : entryId,
        isCurrent ? undefined : latestNumber
    );
    const loading = selected.isLoading || latest.isLoading;
    const errored = selected.isError || latest.isError;
    const diff =
        selected.data && latest.data
            ? diffRevision(schema, latest.data.snapshot, selected.data.snapshot)
            : [];
    const changed = diff.filter((entry) => entry.changed);
    const live = (schema.publishable ?? false) && revision.isPublished;
    const n = revision.number;

    return (
        <section
            aria-labelledby="revision-compare-title"
            className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border"
        >
            <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3.5">
                <span
                    className={cn(
                        'inline-flex h-5 min-w-6 items-center justify-center rounded-[5px] border bg-background px-[5px] text-[11px] font-semibold tabular-nums',
                        live &&
                            'border-transparent bg-success-soft text-success-soft-foreground'
                    )}
                >
                    {intl.formatMessage(messages.version, { n })}
                </span>
                <div className="min-w-0 flex-1">
                    <h3
                        id="revision-compare-title"
                        className="text-[13px] font-semibold leading-5"
                    >
                        {intl.formatMessage(
                            isCurrent ? messages.current : messages.compared
                        )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {intl.formatDate(revision.createdAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        })}
                        {!isCurrent && !loading && !errored
                            ? ` · ${intl.formatMessage(messages.differ, {
                                  count: countChanges(diff)
                              })}`
                            : null}
                    </p>
                </div>
                {!isCurrent ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        aria-label={intl.formatMessage(messages.previewLabel, {
                            n
                        })}
                        onClick={onPreview}
                    >
                        {intl.formatMessage(messages.preview)}
                    </Button>
                ) : null}
                {!isCurrent && canRestore ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs shadow-none"
                        disabled={busy}
                        aria-label={intl.formatMessage(messages.restoreLabel, {
                            n
                        })}
                        onClick={onRestore}
                    >
                        {intl.formatMessage(messages.restore)}
                    </Button>
                ) : null}
                {canPublish && !revision.isPublished ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs shadow-none"
                        disabled={busy}
                        aria-label={intl.formatMessage(messages.publishLabel, {
                            n
                        })}
                        onClick={onPublish}
                    >
                        {intl.formatMessage(messages.publish)}
                    </Button>
                ) : null}
            </div>
            {isCurrent ? (
                <p className="px-4 py-3.5 text-[13px] leading-5 text-muted-foreground">
                    {intl.formatMessage(messages.currentBody)}
                </p>
            ) : loading ? (
                <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-muted-foreground">
                    <Spinner />
                    {intl.formatMessage(messages.loading)}
                </div>
            ) : errored ? (
                <p className="px-4 py-6 text-[13px] text-muted-foreground">
                    {intl.formatMessage(messages.error)}
                </p>
            ) : (
                <div className="flex flex-col">
                    {changed.map((entry) => (
                        <RevisionCompareRow
                            key={entry.field.name}
                            diff={entry}
                            revisionNumber={n}
                            refs={{
                                current:
                                    latest.data?.relationRefs?.[
                                        entry.field.name
                                    ],
                                revision:
                                    selected.data?.relationRefs?.[
                                        entry.field.name
                                    ],
                                currentTotal:
                                    latest.data?.relationTotals?.[
                                        entry.field.name
                                    ],
                                revisionTotal:
                                    selected.data?.relationTotals?.[
                                        entry.field.name
                                    ]
                            }}
                            media={{
                                current:
                                    latest.data?.mediaRefs?.[entry.field.name],
                                revision:
                                    selected.data?.mediaRefs?.[entry.field.name]
                            }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
