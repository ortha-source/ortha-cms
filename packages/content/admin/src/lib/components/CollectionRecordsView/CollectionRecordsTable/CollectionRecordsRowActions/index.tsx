import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Copy,
    Eye,
    MoreHorizontal,
    Pencil,
    Send,
    Trash2,
    Undo2
} from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    toast
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../types/contentType';
import {
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../constants';
import { useEntryStatusActions } from '../../../../api/useEntryStatusActions';
import { ConfirmDialog } from '../../../ConfirmDialog';

/** Intl descriptors for {@link CollectionRecordsRowActions}, co-located. */
const messages = defineMessages({
    open: {
        id: 'content.records.actions.open',
        defaultMessage: 'Actions for this record'
    },
    edit: { id: 'content.records.actions.edit', defaultMessage: 'Edit' },
    view: { id: 'content.records.actions.view', defaultMessage: 'View' },
    publish: {
        id: 'content.records.actions.publish',
        defaultMessage: 'Publish'
    },
    unpublish: {
        id: 'content.records.actions.unpublish',
        defaultMessage: 'Unpublish'
    },
    deleteEntry: {
        id: 'content.records.actions.delete',
        defaultMessage: 'Delete'
    },
    restore: {
        id: 'content.records.actions.restore',
        defaultMessage: 'Restore'
    },
    deleteForever: {
        id: 'content.records.actions.deleteForever',
        defaultMessage: 'Delete permanently'
    },
    copyId: { id: 'content.records.actions.copyId', defaultMessage: 'Copy ID' },
    copied: {
        id: 'content.records.actions.copied.toast',
        defaultMessage: 'Copied record ID'
    },
    copyFailed: {
        id: 'content.records.actions.copyFailed.toast',
        defaultMessage: 'Couldn’t copy the ID'
    },
    published: {
        id: 'content.records.actions.published.toast',
        defaultMessage: 'Published'
    },
    unpublished: {
        id: 'content.records.actions.unpublished.toast',
        defaultMessage: 'Moved to draft'
    },
    softDeleted: {
        id: 'content.records.actions.softDeleted.toast',
        defaultMessage: 'Moved to trash'
    },
    deleted: {
        id: 'content.records.actions.deleted.toast',
        defaultMessage: 'Deleted'
    },
    restored: {
        id: 'content.records.actions.restored.toast',
        defaultMessage: 'Restored'
    },
    actionFailed: {
        id: 'content.records.actions.failed.toast',
        defaultMessage: 'That action didn’t work. Please try again.'
    },
    publishBlocked: {
        id: 'content.records.actions.publishBlocked.toast',
        defaultMessage: 'Can’t publish — this record has validation errors.'
    },
    deleteTitle: {
        id: 'content.records.actions.deleteTitle',
        defaultMessage: 'Delete this entry?'
    },
    deleteBodySoft: {
        id: 'content.records.actions.deleteBodySoft',
        defaultMessage:
            'It will be moved to the trash, where it can be restored.'
    },
    deleteBodyHard: {
        id: 'content.records.actions.deleteBodyHard',
        defaultMessage: 'This permanently removes the entry and can’t be undone.'
    },
    purgeTitle: {
        id: 'content.records.actions.purgeTitle',
        defaultMessage: 'Delete permanently?'
    },
    purgeBody: {
        id: 'content.records.actions.purgeBody',
        defaultMessage:
            'This permanently removes the entry from the trash and can’t be undone.'
    },
    confirmDelete: {
        id: 'content.records.actions.confirmDelete',
        defaultMessage: 'Delete'
    }
});

/**
 * The per-row actions menu for the records table. In the live view: **Edit**
 * (routes to the editor), **Publish/Unpublish** (publishable types, label driven
 * by `status`), **Delete** (soft for paranoid, with confirm), and **Copy ID**.
 * In the **trash** view: **Restore** and **Delete permanently** (with confirm).
 * Mutating actions are permission-gated (`content:publish`/`:delete`). `modal=
 * {false}` so the open menu doesn't trap focus on a row that's also a navigation
 * target; the containing cell stops click propagation.
 */
export function CollectionRecordsRowActions({
    record,
    typePath,
    typeName,
    publishable,
    paranoid,
    trashed = false
}: {
    /** The record this menu acts on. */
    record: EntryRecord;
    /** Absolute path to this type, e.g. `/workspaces/:id/content/:typeName`. */
    typePath: string;
    /** The content type's machine name (for the action mutations). */
    typeName: string;
    /** Whether the type has a publish workflow (drives Publish/Unpublish). */
    publishable: boolean;
    /** Whether the type soft-deletes (drives the delete copy + Restore). */
    paranoid: boolean;
    /** Whether this row is shown in the trash view (Restore / Delete forever). */
    trashed?: boolean;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const actions = useEntryStatusActions(typeName);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmPurge, setConfirmPurge] = useState(false);

    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);

    const published = record.status === ENTRY_STATUS.Published;

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(record.id);
            toast(intl.formatMessage(messages.copied));
        } catch {
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    const run = (
        mutateAsync: (id: string) => Promise<unknown>,
        successId: keyof typeof messages,
        onBlocked?: () => void
    ) => {
        mutateAsync(record.id)
            .then(() => toast(intl.formatMessage(messages[successId])))
            .catch((error) => {
                const status = (error as { status?: number })?.status;
                if (onBlocked && status === 422) onBlocked();
                else toast.error(intl.formatMessage(messages.actionFailed));
            });
    };

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={intl.formatMessage(messages.open)}
                    >
                        <MoreHorizontal aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    {trashed ? (
                        <>
                            {canDelete ? (
                                <DropdownMenuItem
                                    onSelect={() =>
                                        run(
                                            actions.restore.mutateAsync,
                                            'restored'
                                        )
                                    }
                                >
                                    <Undo2 aria-hidden />
                                    {intl.formatMessage(messages.restore)}
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onSelect={copyId}>
                                <Copy aria-hidden />
                                {intl.formatMessage(messages.copyId)}
                            </DropdownMenuItem>
                            {canDelete ? (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => setConfirmPurge(true)}
                                    >
                                        <Trash2 aria-hidden />
                                        {intl.formatMessage(
                                            messages.deleteForever
                                        )}
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <DropdownMenuItem
                                onSelect={() =>
                                    navigate(`${typePath}/${record.id}`)
                                }
                            >
                                {canUpdate ? (
                                    <Pencil aria-hidden />
                                ) : (
                                    <Eye aria-hidden />
                                )}
                                {intl.formatMessage(
                                    canUpdate ? messages.edit : messages.view
                                )}
                            </DropdownMenuItem>

                            {publishable && canPublish ? (
                                <DropdownMenuItem
                                    onSelect={() =>
                                        published
                                            ? run(
                                                  actions.unpublish.mutateAsync,
                                                  'unpublished'
                                              )
                                            : run(
                                                  actions.publish.mutateAsync,
                                                  'published',
                                                  () =>
                                                      toast.error(
                                                          intl.formatMessage(
                                                              messages.publishBlocked
                                                          )
                                                      )
                                              )
                                    }
                                >
                                    {published ? (
                                        <>
                                            <Undo2 aria-hidden />
                                            {intl.formatMessage(
                                                messages.unpublish
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Send aria-hidden />
                                            {intl.formatMessage(
                                                messages.publish
                                            )}
                                        </>
                                    )}
                                </DropdownMenuItem>
                            ) : null}

                            <DropdownMenuItem onSelect={copyId}>
                                <Copy aria-hidden />
                                {intl.formatMessage(messages.copyId)}
                            </DropdownMenuItem>

                            {canDelete ? (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => setConfirmDelete(true)}
                                    >
                                        <Trash2 aria-hidden />
                                        {intl.formatMessage(
                                            messages.deleteEntry
                                        )}
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={intl.formatMessage(messages.deleteTitle)}
                description={intl.formatMessage(
                    paranoid ? messages.deleteBodySoft : messages.deleteBodyHard
                )}
                confirmLabel={intl.formatMessage(messages.confirmDelete)}
                confirmVariant="destructive"
                busy={actions.remove.isPending}
                onConfirm={() => {
                    run(
                        actions.remove.mutateAsync,
                        paranoid ? 'softDeleted' : 'deleted'
                    );
                    setConfirmDelete(false);
                }}
            />

            <ConfirmDialog
                open={confirmPurge}
                onOpenChange={setConfirmPurge}
                title={intl.formatMessage(messages.purgeTitle)}
                description={intl.formatMessage(messages.purgeBody)}
                confirmLabel={intl.formatMessage(messages.deleteForever)}
                confirmVariant="destructive"
                busy={actions.purge.isPending}
                onConfirm={() => {
                    run(actions.purge.mutateAsync, 'deleted');
                    setConfirmPurge(false);
                }}
            />
        </>
    );
}
