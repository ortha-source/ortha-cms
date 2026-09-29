import { defineMessages, useIntl } from 'react-intl';
import { ConfirmDialog } from '@orthacms/design-system';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.content.removeSharedDialog.title',
        defaultMessage: 'Remove “{label}”?'
    },
    description: {
        id: 'workspaces.settings.content.removeSharedDialog.description',
        defaultMessage:
            'This workspace stops reading these records from {workspace}. Nothing in {workspace} changes, and this workspace’s own records of the type are untouched.'
    },
    cancel: {
        id: 'workspaces.settings.content.removeSharedDialog.cancel',
        defaultMessage: 'Cancel'
    },
    remove: {
        id: 'workspaces.settings.content.removeSharedDialog.remove',
        defaultMessage: 'Remove'
    }
});

/** Props for {@link RemoveSharedContentDialog}. */
export type RemoveSharedContentDialogProps = {
    /** Whether the dialog is shown. */
    open: boolean;
    /** The grant's label, "{Type} · {Workspace}". */
    label: string;
    /** The source workspace's name. */
    workspaceName: string;
    /** Close callback; ignored while the revoke is in flight. */
    onClose: () => void;
    /** Runs the revoke. */
    onConfirm: () => void;
    /** Forwarded to the dialog, to land focus once the row is gone. */
    onCloseAutoFocus?: (event: Event) => void;
    /** Whether the revoke is in flight. */
    busy?: boolean;
};

/**
 * Confirms revoking a grant **from a shared workspace**. Unlike the own-grant
 * dialog there is no entry-count pre-check: the records live at the source, so
 * this workspace holds none of them and the revoke cannot be blocked by them.
 */
export function RemoveSharedContentDialog({
    open,
    label,
    workspaceName,
    onClose,
    onConfirm,
    onCloseAutoFocus,
    busy = false
}: RemoveSharedContentDialogProps) {
    const intl = useIntl();
    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
            title={intl.formatMessage(messages.title, { label })}
            description={intl.formatMessage(messages.description, {
                workspace: workspaceName
            })}
            confirmLabel={intl.formatMessage(messages.remove)}
            cancelLabel={intl.formatMessage(messages.cancel)}
            confirmVariant="destructive"
            busy={busy}
            onCloseAutoFocus={onCloseAutoFocus}
            onConfirm={onConfirm}
        />
    );
}
