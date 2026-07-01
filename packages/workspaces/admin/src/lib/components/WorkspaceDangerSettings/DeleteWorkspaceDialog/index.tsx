import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner
} from '@ortha-cms/design-system';
import type { Workspace } from '../../../types/workspace';
import { useWorkspaceEntryCount } from '../../../api/useWorkspaceEntryCount';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.danger.deleteDialog.title',
        defaultMessage: 'Delete “{name}”?'
    },
    description: {
        id: 'workspaces.settings.danger.deleteDialog.description',
        defaultMessage:
            'This permanently deletes the workspace, all {members, plural, one {# membership} other {# memberships}}, and its content grants. This cannot be undone.'
    },
    checking: {
        id: 'workspaces.settings.danger.deleteDialog.checking',
        defaultMessage: 'Checking for existing content…'
    },
    checkError: {
        id: 'workspaces.settings.danger.deleteDialog.checkError',
        defaultMessage:
            'Couldn’t check for existing content, so deletion is blocked. Please try again.'
    },
    blocked: {
        id: 'workspaces.settings.danger.deleteDialog.blocked',
        defaultMessage:
            'This workspace still has {count, plural, one {# content entry} other {# content entries}} across its content types. Delete all content first — a workspace can only be deleted once it holds no records.'
    },
    cancel: {
        id: 'workspaces.settings.danger.deleteDialog.cancel',
        defaultMessage: 'Cancel'
    },
    confirm: {
        id: 'workspaces.settings.danger.deleteDialog.confirm',
        defaultMessage: 'Delete workspace'
    }
});

/** Props for {@link DeleteWorkspaceDialog}. */
export type DeleteWorkspaceDialogProps = {
    /** The workspace being deleted, or `null` when the dialog is closed. */
    workspace: Workspace | null;
    /** Close callback; ignored while the delete is in flight. */
    onClose: () => void;
    /** Runs the delete (only reachable once the workspace is empty). */
    onConfirm: () => void;
    /** Whether the delete is in flight. */
    busy?: boolean;
};

/**
 * Confirm dialog for permanently deleting a workspace. On open it reads the
 * workspace's total content-entry count and **blocks** the Delete button with a
 * warning while any content remains — so a delete can never orphan records (the
 * server enforces the same rule with a 409). Delete is enabled only once the
 * count is known to be zero.
 */
export function DeleteWorkspaceDialog({
    workspace,
    onClose,
    onConfirm,
    busy = false
}: DeleteWorkspaceDialogProps) {
    const intl = useIntl();
    const open = workspace !== null;
    const {
        data: count,
        isPending,
        isError
    } = useWorkspaceEntryCount(workspace?.id ?? '', open);

    const checking = isPending;
    const hasEntries = typeof count === 'number' && count > 0;
    const canDelete = open && !isError && !checking && count === 0;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            name: workspace?.name ?? ''
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description, {
                            members: workspace?.members.length ?? 0
                        })}
                    </DialogDescription>
                </DialogHeader>

                {checking ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        {intl.formatMessage(messages.checking)}
                    </p>
                ) : isError ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>
                            {intl.formatMessage(messages.checkError)}
                        </AlertDescription>
                    </Alert>
                ) : hasEntries ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>
                            {intl.formatMessage(messages.blocked, { count })}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={busy}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={!canDelete || busy}
                    >
                        {busy ? <Spinner /> : null}
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
