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
import { useWorkspaceContentCount } from '../../../api/useWorkspaceContentCount';

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
 * zero.
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

    // Enable Remove only once we've confirmed the type is empty.
    const checking = isPending;
    const hasEntries = typeof count === 'number' && count > 0;
    const canRemove = open && !isError && !checking && count === 0;

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
                        {intl.formatMessage(messages.title, { label })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
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
                        disabled={!canRemove || busy}
                    >
                        {busy ? <Spinner /> : null}
                        {intl.formatMessage(messages.remove)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
