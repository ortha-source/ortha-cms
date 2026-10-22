import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ConfirmDialog, toast } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import type {
    ContentTypeDetail,
    RevisionSummary
} from '../../../../../domain/types/contentType';
import {
    CONTENT_PUBLISH,
    CONTENT_UPDATE
} from '../../../../../domain/constants';
import {
    useRevisionActions,
    type RevisionAction
} from '../../../../../application/useRevisionActions';
import {
    siblingSyncRefusalFrom,
    type SiblingSyncRefusal
} from '../../../../../infrastructure/entryIssues';
import { SiblingSyncDialog } from '../SiblingSyncDialog';
import { fieldLabel } from '../../../../../domain/entryColumns';
import { RevisionRow } from './RevisionRow';
import { RevisionPreviewDialog } from './RevisionPreviewDialog';
import { TimelineEventRow } from './TimelineEventRow';
import type { EntryTimelineEvent } from '../../../../slots/contentSlots';

/** One row of the timeline: a version, or something done to the record. */
type TimelineRow =
    | { kind: 'revision'; at: number; revision: RevisionSummary }
    | { kind: 'event'; at: number; event: EntryTimelineEvent };

/** A local calendar day, as a key rows are grouped by. */
function dayKey(at: number): string {
    const date = new Date(at);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const messages = defineMessages({
    confirmTitle: {
        id: 'content.revisions.confirmTitle',
        defaultMessage: 'Restore version {n}?'
    },
    confirmBody: {
        id: 'content.revisions.confirmBody',
        defaultMessage:
            'This re-applies that version to the record and saves it as a new revision. Nothing in the history is lost.'
    },
    confirm: {
        id: 'content.revisions.confirm',
        defaultMessage: 'Restore'
    },
    restored: {
        id: 'content.revisions.restored',
        defaultMessage: 'Restored version {n} as a new revision.'
    },
    restoreFailed: {
        id: 'content.revisions.restoreFailed',
        defaultMessage: 'Could not restore that version. Please try again.'
    },
    publishConfirmTitle: {
        id: 'content.revisions.publishConfirmTitle',
        defaultMessage: 'Publish version {n}?'
    },
    publishConfirmBody: {
        id: 'content.revisions.publishConfirmBody',
        defaultMessage:
            'This makes that version the live one. An earlier version is re-applied to the record first; the currently live version becomes superseded.'
    },
    publishConfirm: {
        id: 'content.revisions.publishConfirm',
        defaultMessage: 'Publish'
    },
    published: {
        id: 'content.revisions.published',
        defaultMessage: 'Version {n} is now live.'
    },
    publishFailed: {
        id: 'content.revisions.publishFailed',
        defaultMessage: 'Could not publish that version. It may be incomplete.'
    }
});

/**
 * The revision list behind the editor's **History** tab — the entry's whole
 * version timeline, which is the one place it is read and restored from. It
 * renders a {@link RevisionRow} per revision and owns the **restore** and
 * **publish-a-version** flows (permission gates, confirmations, and success /
 * failure toasts). Restore re-applies a snapshot as a new draft; publish makes a
 * chosen version the live one (an earlier version is restored then published).
 */
export function RevisionList({
    typeName,
    entryId,
    schema,
    revisions,
    events = []
}: {
    typeName: string;
    entryId: string;
    /** The type's full field schema — drives the preview diff's labels + values. */
    schema: ContentTypeDetail;
    revisions: RevisionSummary[];
    /**
     * Rows from the timeline sources (`ENTRY_TIMELINE_SLOT` — the record's
     * activity), drawn between the versions by time.
     */
    events?: EntryTimelineEvent[];
}) {
    const intl = useIntl();
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const publishable = schema.publishable ?? false;
    const { restore, restoring, publish, publishing } = useRevisionActions(
        typeName,
        entryId
    );
    const [pending, setPending] = useState<number | null>(null);
    const [pendingPublish, setPendingPublish] = useState<number | null>(null);
    const [previewing, setPreviewing] = useState<RevisionSummary | null>(null);
    // A restore or publish-a-version the server refused because re-applying
    // the version reaches other rows (the record's other locales above all) —
    // held for the person to confirm, exactly as an editor save is.
    const [pendingSync, setPendingSync] = useState<{
        kind: 'restore' | 'publish';
        number: number;
        refusal: SiblingSyncRefusal;
    } | null>(null);

    const labelFor = (name: string) => {
        const field = schema.fields.find(
            (candidate) => candidate.name === name
        );
        return field ? fieldLabel(field) : name;
    };

    // The diff baseline: the newest version equals the live record (every save
    // appends one). It's always present here — the timeline is passed
    // newest-first — but fall back to the highest number defensively.
    const latestNumber =
        revisions.find((revision) => revision.isLatest)?.number ??
        revisions.reduce((max, r) => Math.max(max, r.number), 0);

    // Both actions ask the server first, like a save: re-applying a version
    // rewrites the record's shared fields, so it can reach other locales,
    // and only the server knows what that does to them. A refusal opens the
    // sync dialog; its confirmation resends without asking.
    const runRestore = (action: RevisionAction) =>
        restore(action, {
            onSuccess: () =>
                toast.success(
                    intl.formatMessage(messages.restored, { n: action.number })
                ),
            onError: (error) => {
                const refusal = siblingSyncRefusalFrom(error);
                if (refusal) {
                    setPendingSync({
                        kind: 'restore',
                        number: action.number,
                        refusal
                    });
                    return;
                }
                toast.error(intl.formatMessage(messages.restoreFailed));
            }
        });

    const runPublish = (action: RevisionAction) =>
        publish(action, {
            onSuccess: () =>
                toast.success(
                    intl.formatMessage(messages.published, { n: action.number })
                ),
            onError: (error) => {
                const refusal = siblingSyncRefusalFrom(error);
                if (refusal) {
                    setPendingSync({
                        kind: 'publish',
                        number: action.number,
                        refusal
                    });
                    return;
                }
                toast.error(intl.formatMessage(messages.publishFailed));
            }
        });

    const confirmRestore = () => {
        if (pending == null) return;
        runRestore({
            number: pending,
            options: { askBeforeSiblingSync: true }
        });
        setPending(null);
    };

    const confirmPublish = () => {
        if (pendingPublish == null) return;
        runPublish({
            number: pendingPublish,
            options: { askBeforeSiblingSync: true }
        });
        setPendingPublish(null);
    };

    const confirmSync = () => {
        const held = pendingSync;
        setPendingSync(null);
        if (!held) return;
        // Resent without asking; an invalidation is confirmed only if the
        // person was shown one.
        const action: RevisionAction = {
            number: held.number,
            options: {
                allowInvalidSiblings: held.refusal.invalidated.length > 0
            }
        };
        if (held.kind === 'restore') runRestore(action);
        else runPublish(action);
    };

    // One timeline, newest first, grouped by day: the versions and whatever
    // the sources add between them. An event with an unreadable time sorts
    // last rather than vanishing.
    const rows: TimelineRow[] = [
        ...revisions.map((revision) => ({
            kind: 'revision' as const,
            at: Date.parse(revision.createdAt) || 0,
            revision
        })),
        ...events.map((event) => ({
            kind: 'event' as const,
            at: new Date(event.at).getTime() || 0,
            event
        }))
    ].sort((a, b) => b.at - a.at);
    const days: { key: string; at: number; rows: TimelineRow[] }[] = [];
    for (const row of rows) {
        const key = dayKey(row.at);
        const last = days[days.length - 1];
        if (last?.key === key) last.rows.push(row);
        else days.push({ key, at: row.at, rows: [row] });
    }

    return (
        <>
            <div className="flex flex-col gap-5">
                {days.map((day) => (
                    <div key={day.key}>
                        <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                            {intl.formatDate(day.at, { dateStyle: 'medium' })}
                        </h3>
                        <ul className="divide-y divide-border/60">
                            {day.rows.map((row) =>
                                row.kind === 'revision' ? (
                                    <li key={row.revision.id}>
                                        <RevisionRow
                                            revision={row.revision}
                                            canUpdate={canUpdate}
                                            canPublish={canPublish}
                                            publishable={publishable}
                                            busy={restoring || publishing}
                                            onRestore={setPending}
                                            onPublish={setPendingPublish}
                                            onPreview={() =>
                                                setPreviewing(row.revision)
                                            }
                                        />
                                    </li>
                                ) : (
                                    <li key={`event:${row.event.id}`}>
                                        <TimelineEventRow event={row.event} />
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                ))}
            </div>
            <ConfirmDialog
                open={pending != null}
                onOpenChange={(open) => !open && setPending(null)}
                title={intl.formatMessage(messages.confirmTitle, {
                    n: pending ?? 0
                })}
                description={intl.formatMessage(messages.confirmBody)}
                confirmLabel={intl.formatMessage(messages.confirm)}
                busy={restoring}
                onConfirm={confirmRestore}
            />
            <ConfirmDialog
                open={pendingPublish != null}
                onOpenChange={(open) => !open && setPendingPublish(null)}
                title={intl.formatMessage(messages.publishConfirmTitle, {
                    n: pendingPublish ?? 0
                })}
                description={intl.formatMessage(messages.publishConfirmBody)}
                confirmLabel={intl.formatMessage(messages.publishConfirm)}
                busy={publishing}
                onConfirm={confirmPublish}
            />
            <SiblingSyncDialog
                refusal={pendingSync?.refusal ?? null}
                sharedFields={[]}
                labelFor={labelFor}
                onCancel={() => setPendingSync(null)}
                onConfirm={confirmSync}
                confirmLabel={
                    pendingSync?.refusal.invalidated.length
                        ? undefined
                        : intl.formatMessage(
                              pendingSync?.kind === 'publish'
                                  ? messages.publishConfirm
                                  : messages.confirm
                          )
                }
            />
            {previewing && (
                <RevisionPreviewDialog
                    open
                    onOpenChange={(open) => !open && setPreviewing(null)}
                    typeName={typeName}
                    entryId={entryId}
                    schema={schema}
                    revision={previewing}
                    latestNumber={latestNumber}
                    canRestore={canUpdate}
                    canPublish={canPublish && publishable}
                    onRestore={setPending}
                    onPublish={setPendingPublish}
                />
            )}
        </>
    );
}
