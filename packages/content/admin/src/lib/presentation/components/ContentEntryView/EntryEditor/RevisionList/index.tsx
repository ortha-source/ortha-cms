import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ConfirmDialog, toast } from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import type { RevisionSummary } from '../../../../../domain/types/contentType';
import { CONTENT_UPDATE } from '../../../../../domain/constants';
import { useRevisionActions } from '../../../../../application/useRevisionActions';
import { RevisionRow } from './RevisionRow';

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
    }
});

/**
 * The shared revision list — the core of both the sidebar {@link RevisionWidget}
 * and the History-tab timeline. Renders a {@link RevisionRow} per revision and
 * owns the **restore** flow (permission gate, confirmation, and the success /
 * failure toast) so both mount points behave identically. Restore re-applies an
 * earlier snapshot and is itself saved as a new revision, so the timeline
 * refreshes in place.
 */
export function RevisionList({
    typeName,
    entryId,
    revisions
}: {
    typeName: string;
    entryId: string;
    revisions: RevisionSummary[];
}) {
    const intl = useIntl();
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const { restore, restoring } = useRevisionActions(typeName, entryId);
    const [pending, setPending] = useState<number | null>(null);

    const confirmRestore = () => {
        if (pending == null) return;
        const number = pending;
        restore(number, {
            onSuccess: () =>
                toast.success(
                    intl.formatMessage(messages.restored, { n: number })
                ),
            onError: () =>
                toast.error(intl.formatMessage(messages.restoreFailed))
        });
        setPending(null);
    };

    return (
        <>
            <ul className="divide-y divide-border/60">
                {revisions.map((revision) => (
                    <li key={revision.id}>
                        <RevisionRow
                            revision={revision}
                            canUpdate={canUpdate}
                            busy={restoring}
                            onRestore={setPending}
                        />
                    </li>
                ))}
            </ul>
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
        </>
    );
}
