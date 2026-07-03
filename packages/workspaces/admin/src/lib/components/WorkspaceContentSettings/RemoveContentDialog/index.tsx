import { defineMessages, useIntl } from 'react-intl';
import { useWorkspaceContentCount } from '../../../api/useWorkspaceContentCount';
import { BlockingConfirmDialog } from '../../BlockingConfirmDialog';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.content.removeDialog.title',
        defaultMessage: 'Remove “{label}”?'
    },
    checking: {
        id: 'workspaces.settings.content.removeDialog.checking',
        defaultMessage: 'Checking for existing content…'
    },
    checkError: {
        id: 'workspaces.settings.content.removeDialog.checkError',
        defaultMessage:
            'Couldn’t check for existing content, so removal is blocked. Please try again.'
    },
    description: {
        id: 'workspaces.settings.content.removeDialog.description',
        defaultMessage:
            'Removing a content type stops this workspace from using it. Records in other workspaces are untouched.'
    },
    blocked: {
        id: 'workspaces.settings.content.removeDialog.blocked',
        defaultMessage:
            'This content type still has {count, plural, one {# entry} other {# entries}} in this workspace. Delete {count, plural, one {it} other {them}} first — the workspace can only stop using a content type once it holds none.'
    },
    cancel: {
        id: 'workspaces.settings.content.removeDialog.cancel',
        defaultMessage: 'Cancel'
    },
    remove: {
        id: 'workspaces.settings.content.removeDialog.remove',
        defaultMessage: 'Remove'
    }
});

/** Props for {@link RemoveContentDialog}. */
export type RemoveContentDialogProps = {
    /** The workspace the grant belongs to. */
    workspaceId: string;
    /** The slug being revoked, or `null` when the dialog is closed. */
    slug: string | null;
    /** Human label for the type (falls back to the slug). */
    label: string;
    /** Close callback; ignored while a revoke is in flight. */
    onClose: () => void;
    /** Runs the revoke (only reachable when the type is empty). */
    onConfirm: () => void;
    /** Whether the revoke is in flight. */
    busy?: boolean;
};

/**
 * Confirm dialog for revoking a content-type grant. On open it reads the type's
 * entry count in the workspace and **blocks** the Remove button with a warning
 * when the type isn't empty — so the user learns *why* up front instead of
 * hitting the server's 409. Remove is enabled only once the count is known to be
 * zero. The checking / error / blocked chrome lives in the shared
 * {@link BlockingConfirmDialog}.
 */
export function RemoveContentDialog({
    workspaceId,
    slug,
    label,
    onClose,
    onConfirm,
    busy = false
}: RemoveContentDialogProps) {
    const intl = useIntl();
    const open = slug !== null;
    const {
        data: count,
        isPending,
        isError
    } = useWorkspaceContentCount(workspaceId, slug, open);

    return (
        <BlockingConfirmDialog
            open={open}
            title={intl.formatMessage(messages.title, { label })}
            description={intl.formatMessage(messages.description)}
            isChecking={isPending}
            isError={isError}
            count={count}
            checkingLabel={intl.formatMessage(messages.checking)}
            checkErrorLabel={intl.formatMessage(messages.checkError)}
            blockedLabel={intl.formatMessage(messages.blocked, { count })}
            confirmLabel={intl.formatMessage(messages.remove)}
            cancelLabel={intl.formatMessage(messages.cancel)}
            onClose={onClose}
            onConfirm={onConfirm}
            busy={busy}
        />
    );
}
