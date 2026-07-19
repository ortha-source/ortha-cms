import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Send, Trash2, Undo2 } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Button,
    ConfirmDialog,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import { CONTENT_DELETE, CONTENT_PUBLISH } from '../../../../domain/constants';
import { useBulkEntryActions } from '../../../../application/useBulkEntryActions';
import { BulkPublishDialog } from '../BulkPublishDialog';

const messages = defineMessages({
    publish: { id: 'content.bulk.publish', defaultMessage: 'Publish' },
    unpublish: { id: 'content.bulk.unpublish', defaultMessage: 'Unpublish' },
    deleteEntries: { id: 'content.bulk.delete', defaultMessage: 'Delete' },
    restore: { id: 'content.bulk.restore', defaultMessage: 'Restore' },
    deleteForever: {
        id: 'content.bulk.deleteForever',
        defaultMessage: 'Delete permanently'
    },
    unpublished: {
        id: 'content.bulk.unpublished.toast',
        defaultMessage:
            '{count, plural, one {# record unpublished} other {# records unpublished}}.'
    },
    deleted: {
        id: 'content.bulk.deleted.toast',
        defaultMessage:
            '{count, plural, one {# record deleted} other {# records deleted}}.'
    },
    restored: {
        id: 'content.bulk.restored.toast',
        defaultMessage:
            '{count, plural, one {# record restored} other {# records restored}}.'
    },
    failed: {
        id: 'content.bulk.failed.toast',
        defaultMessage: 'That action didn’t work. Please try again.'
    },
    noneAffected: {
        id: 'content.bulk.noneAffected.toast',
        defaultMessage:
            'No records were changed — they may have already been updated elsewhere.'
    },
    deleteTitle: {
        id: 'content.bulk.deleteTitle',
        defaultMessage:
            'Delete {count, plural, one {# record} other {# records}}?'
    },
    deleteBodySoft: {
        id: 'content.bulk.deleteBodySoft',
        defaultMessage:
            'They will be moved to the trash, where they can be restored.'
    },
    deleteBodyHard: {
        id: 'content.bulk.deleteBodyHard',
        defaultMessage:
            'This permanently removes the records and can’t be undone.'
    },
    purgeTitle: {
        id: 'content.bulk.purgeTitle',
        defaultMessage:
            'Permanently delete {count, plural, one {# record} other {# records}}?'
    },
    purgeBody: {
        id: 'content.bulk.purgeBody',
        defaultMessage: 'This empties them from the trash and can’t be undone.'
    },
    confirmDelete: {
        id: 'content.bulk.confirmDelete',
        defaultMessage: 'Delete'
    }
});

/**
 * The bulk action controls rendered inside the selection bar. In the live view:
 * **Publish** (opens the dry-run {@link BulkPublishDialog}), **Unpublish**, and
 * **Delete** (confirm). In the **trash** view: **Restore** and **Delete
 * permanently** (confirm). All gated by permission and scoped to the current
 * selection; each clears the selection (`onDone`) after it succeeds.
 */
export function CollectionRecordsBulkActions({
    typeName,
    ids,
    publishable,
    paranoid,
    trashed = false,
    onDone
}: {
    typeName: string;
    /** The selected entry ids. */
    ids: string[];
    publishable: boolean;
    paranoid: boolean;
    trashed?: boolean;
    /** Clears the selection after a successful action. */
    onDone: () => void;
}) {
    const intl = useIntl();
    const bulk = useBulkEntryActions(typeName);
    const [publishOpen, setPublishOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmPurge, setConfirmPurge] = useState(false);

    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);

    const run = (
        mutateAsync: (ids: string[]) => Promise<{ count: number }>,
        messageId: 'unpublished' | 'deleted' | 'restored'
    ) => {
        mutateAsync(ids)
            .then((result) =>
                // A 0 count means nothing matched (e.g. the rows changed in
                // another tab) — don't report "0 records …" as a success.
                result.count === 0
                    ? toast.info(intl.formatMessage(messages.noneAffected))
                    : toast.success(
                          intl.formatMessage(messages[messageId], {
                              count: result.count
                          })
                      )
            )
            .catch(() => toast.error(intl.formatMessage(messages.failed)))
            .finally(onDone);
    };

    if (trashed) {
        return (
            <>
                {canDelete ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            disabled={bulk.restore.isPending}
                            onClick={() =>
                                run(bulk.restore.mutateAsync, 'restored')
                            }
                        >
                            {bulk.restore.isPending ? (
                                <Spinner aria-hidden />
                            ) : (
                                <Undo2 aria-hidden />
                            )}
                            {intl.formatMessage(messages.restore)}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive shadow-none hover:text-destructive"
                            disabled={bulk.purge.isPending}
                            onClick={() => setConfirmPurge(true)}
                        >
                            <Trash2 aria-hidden />
                            {intl.formatMessage(messages.deleteForever)}
                        </Button>
                    </>
                ) : null}

                <ConfirmDialog
                    open={confirmPurge}
                    onOpenChange={setConfirmPurge}
                    title={intl.formatMessage(messages.purgeTitle, {
                        count: ids.length
                    })}
                    description={intl.formatMessage(messages.purgeBody)}
                    confirmLabel={intl.formatMessage(messages.deleteForever)}
                    confirmVariant="destructive"
                    busy={bulk.purge.isPending}
                    onConfirm={() => {
                        run(bulk.purge.mutateAsync, 'deleted');
                        setConfirmPurge(false);
                    }}
                />
            </>
        );
    }

    return (
        <>
            {publishable && canPublish ? (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={() => setPublishOpen(true)}
                    >
                        <Send aria-hidden />
                        {intl.formatMessage(messages.publish)}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        disabled={bulk.unpublish.isPending}
                        onClick={() =>
                            run(bulk.unpublish.mutateAsync, 'unpublished')
                        }
                    >
                        {bulk.unpublish.isPending ? (
                            <Spinner aria-hidden />
                        ) : (
                            <Undo2 aria-hidden />
                        )}
                        {intl.formatMessage(messages.unpublish)}
                    </Button>
                </>
            ) : null}

            {canDelete ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive shadow-none hover:text-destructive"
                    disabled={bulk.remove.isPending}
                    onClick={() => setConfirmDelete(true)}
                >
                    <Trash2 aria-hidden />
                    {intl.formatMessage(messages.deleteEntries)}
                </Button>
            ) : null}

            {publishable && canPublish ? (
                <BulkPublishDialog
                    open={publishOpen}
                    onOpenChange={setPublishOpen}
                    typeName={typeName}
                    ids={ids}
                    onPublished={onDone}
                />
            ) : null}

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={intl.formatMessage(messages.deleteTitle, {
                    count: ids.length
                })}
                description={intl.formatMessage(
                    paranoid ? messages.deleteBodySoft : messages.deleteBodyHard
                )}
                confirmLabel={intl.formatMessage(messages.confirmDelete)}
                confirmVariant="destructive"
                busy={bulk.remove.isPending}
                onConfirm={() => {
                    run(bulk.remove.mutateAsync, 'deleted');
                    setConfirmDelete(false);
                }}
            />
        </>
    );
}
