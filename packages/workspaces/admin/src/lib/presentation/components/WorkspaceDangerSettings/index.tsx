import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { TriangleAlert } from 'lucide-react';
import { Button, toast } from '@orthacms/design-system';
import { ArchiveWorkspaceDialog } from '../ArchiveWorkspaceDialog';
import type { Workspace } from '../../../domain/types/workspace';
import { useSetWorkspaceStatus } from '../../../application/useSetWorkspaceStatus';
import { useDeleteWorkspace } from '../../../application/useDeleteWorkspace';
import { useWorkspaceEntryCount } from '../../../application/useWorkspaceEntryCount';
import { isConflict } from '../../../infrastructure/isConflict';
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog';

const messages = defineMessages({
    stillHolds: {
        id: 'workspaces.settings.danger.stillHolds',
        defaultMessage:
            '{count, plural, one {It still holds # entry.} other {It still holds # entries.}}'
    },
    stillHoldsBody: {
        id: 'workspaces.settings.danger.stillHoldsBody',
        defaultMessage:
            'Delete or move them first — the delete stays blocked until then.'
    },
    openContent: {
        id: 'workspaces.settings.danger.openContent',
        defaultMessage: 'Open Content'
    },
    archiveHeading: {
        id: 'workspaces.settings.danger.archiveHeading',
        defaultMessage: 'Archive workspace'
    },
    archiveBody: {
        id: 'workspaces.settings.danger.archiveBody',
        defaultMessage:
            'Hides it from everyday use. Records, members and settings stay; unarchive it any time.'
    },
    unarchiveHeading: {
        id: 'workspaces.settings.danger.unarchiveHeading',
        defaultMessage: 'Unarchive workspace'
    },
    unarchiveBody: {
        id: 'workspaces.settings.danger.unarchiveBody',
        defaultMessage: 'This workspace is archived. Restore it to active use.'
    },
    archiveAction: {
        id: 'workspaces.settings.danger.archiveAction',
        defaultMessage: 'Archive'
    },
    unarchiveAction: {
        id: 'workspaces.settings.danger.unarchiveAction',
        defaultMessage: 'Unarchive'
    },
    deleteHeading: {
        id: 'workspaces.settings.danger.deleteHeading',
        defaultMessage: 'Delete workspace'
    },
    deleteBody: {
        id: 'workspaces.settings.danger.deleteBody',
        defaultMessage:
            'Removes the workspace, its members’ access and its settings for good.'
    },
    deleteAction: {
        id: 'workspaces.settings.danger.deleteAction',
        defaultMessage: 'Delete workspace'
    },
    archived: {
        id: 'workspaces.settings.danger.archived',
        defaultMessage: 'Workspace archived.'
    },
    unarchived: {
        id: 'workspaces.settings.danger.unarchived',
        defaultMessage: 'Workspace restored.'
    },
    statusError: {
        id: 'workspaces.settings.danger.statusError',
        defaultMessage:
            'Couldn’t change the workspace status. Please try again.'
    },
    deleted: {
        id: 'workspaces.settings.danger.deleted',
        defaultMessage: 'Workspace deleted.'
    },
    deleteError: {
        id: 'workspaces.settings.danger.deleteError',
        defaultMessage: 'Couldn’t delete the workspace. Please try again.'
    },
    deleteNotEmpty: {
        id: 'workspaces.settings.danger.deleteNotEmpty',
        defaultMessage:
            'This workspace still has content. Delete all records first, then delete the workspace.'
    }
});

/** Props for {@link WorkspaceDangerSettings}. */
export type WorkspaceDangerSettingsProps = {
    /** The workspace being managed. */
    workspace: Workspace;
    /** Whether the user may archive/unarchive (holds `workspaces:update`). */
    canUpdate: boolean;
    /** Whether the user may delete (holds `workspaces:delete`). */
    canDelete: boolean;
};

/**
 * The Danger zone: archive/unarchive (`workspaces:update`) and permanently
 * delete (`workspaces:delete`) as rows of one red-ruled card, each behind a
 * confirmation. While the workspace still holds entries the Delete row says
 * so — how many, and where to go — before anybody opens the dialog.
 * On delete the user is sent back to the workspaces grid (the shell route is
 * gone).
 */
export function WorkspaceDangerSettings({
    workspace,
    canUpdate,
    canDelete
}: WorkspaceDangerSettingsProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const setStatus = useSetWorkspaceStatus();
    const remove = useDeleteWorkspace();
    const [confirmingArchive, setConfirmingArchive] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const isArchived = workspace.status === 'Archived';
    // Said on the page, before anyone presses Delete: the dialog still runs
    // its own check (a count can change in between), this only spares a
    // click that was never going to work. Unread or failed, it says nothing.
    const holdings = useWorkspaceEntryCount(workspace.id, canDelete, 'summary');
    const stillHolds = holdings.data ?? 0;

    const toggleArchive = async () => {
        try {
            await setStatus.mutateAsync({
                id: workspace.id,
                status: isArchived ? 'Active' : 'Archived'
            });
            toast.success(
                intl.formatMessage(
                    isArchived ? messages.unarchived : messages.archived
                )
            );
        } catch {
            toast.error(intl.formatMessage(messages.statusError));
        } finally {
            setConfirmingArchive(false);
        }
    };

    const confirmDelete = async () => {
        try {
            await remove.mutateAsync(workspace.id);
            toast.success(intl.formatMessage(messages.deleted));
            navigate('/workspaces');
        } catch (error) {
            // The dialog blocks a non-empty delete up front; this 409 is only a
            // safety net for content created between the check and the confirm.
            (isConflict(error) ? toast.warning : toast.error)(
                intl.formatMessage(
                    isConflict(error)
                        ? messages.deleteNotEmpty
                        : messages.deleteError
                )
            );
            setConfirmingDelete(false);
        }
    };

    return (
        <>
            <div className="overflow-hidden rounded-xl border border-destructive/35 bg-card">
                {canUpdate ? (
                    <div className="flex items-start gap-4 p-4">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <h2 className="text-sm font-medium">
                                {intl.formatMessage(
                                    isArchived
                                        ? messages.unarchiveHeading
                                        : messages.archiveHeading
                                )}
                            </h2>
                            <p className="text-[13px] text-muted-foreground">
                                {intl.formatMessage(
                                    isArchived
                                        ? messages.unarchiveBody
                                        : messages.archiveBody
                                )}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            disabled={setStatus.isPending}
                            onClick={() => {
                                // Unarchiving is low-risk, so it applies
                                // directly; archiving asks first.
                                if (isArchived) {
                                    toggleArchive();
                                } else {
                                    setConfirmingArchive(true);
                                }
                            }}
                        >
                            {intl.formatMessage(
                                isArchived
                                    ? messages.unarchiveAction
                                    : messages.archiveAction
                            )}
                        </Button>
                    </div>
                ) : null}

                {canDelete ? (
                    <div className="flex items-start gap-4 border-t border-destructive/20 p-4 first:border-t-0">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <h2 className="text-sm font-medium">
                                {intl.formatMessage(messages.deleteHeading)}
                            </h2>
                            <p className="text-[13px] text-muted-foreground">
                                {intl.formatMessage(messages.deleteBody)}
                            </p>
                            {stillHolds > 0 ? (
                                <p className="mt-2 flex gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-[13px] text-warning-soft-foreground">
                                    <TriangleAlert
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-hidden
                                    />
                                    <span>
                                        <span className="font-medium">
                                            {intl.formatMessage(
                                                messages.stillHolds,
                                                { count: stillHolds }
                                            )}
                                        </span>{' '}
                                        {intl.formatMessage(
                                            messages.stillHoldsBody
                                        )}{' '}
                                        <Link
                                            to={`/workspaces/${workspace.id}/content`}
                                            className="underline underline-offset-2"
                                        >
                                            {intl.formatMessage(
                                                messages.openContent
                                            )}
                                        </Link>
                                    </span>
                                </p>
                            ) : null}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive-soft hover:text-destructive"
                            disabled={remove.isPending}
                            onClick={() => setConfirmingDelete(true)}
                        >
                            {intl.formatMessage(messages.deleteAction)}
                        </Button>
                    </div>
                ) : null}
            </div>

            {/* The same confirmation the cards' ⋯ menu opens: what stays and
                who notices, counted before the button. */}
            <ArchiveWorkspaceDialog
                workspace={confirmingArchive ? workspace : null}
                onClose={() => setConfirmingArchive(false)}
                busy={setStatus.isPending}
                onConfirm={toggleArchive}
            />

            <DeleteWorkspaceDialog
                workspace={confirmingDelete ? workspace : null}
                onClose={() => setConfirmingDelete(false)}
                onConfirm={confirmDelete}
                busy={remove.isPending}
            />
        </>
    );
}
