import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    SkeletonRegion,
    Spinner
} from '@orthacms/design-system';
import { useArchiveImpact } from '../../../application/useArchiveImpact';
import type { Workspace } from '../../../domain/types/workspace';

const messages = defineMessages({
    title: {
        id: 'workspaces.archive.title',
        defaultMessage: 'Archive {name}?'
    },
    description: {
        id: 'workspaces.archive.description',
        defaultMessage:
            'It leaves the sidebar and the list. Nothing is deleted:'
    },
    records: {
        id: 'workspaces.archive.records',
        defaultMessage:
            '{count, plural, =0 {No records to keep} one {# record stays where it is} other {# records stay where they are}}'
    },
    members: {
        id: 'workspaces.archive.members',
        defaultMessage:
            '{count, plural, one {# member keeps their account} other {# members keep their accounts}}'
    },
    linked: {
        id: 'workspaces.archive.linked',
        defaultMessage:
            '{count, plural, one {# workspace linking its records sees them as unavailable} other {# workspaces linking its records see them as unavailable}}'
    },
    loading: {
        id: 'workspaces.archive.loading',
        defaultMessage: 'Counting what this affects…'
    },
    loadError: {
        id: 'workspaces.archive.loadError',
        defaultMessage:
            'Couldn’t count what this affects. Archiving still deletes nothing.'
    },
    restoreHint: {
        id: 'workspaces.archive.restoreHint',
        defaultMessage: 'Restore it any time from Workspaces → Archived.'
    },
    cancel: { id: 'workspaces.archive.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'workspaces.archive.confirm',
        defaultMessage: 'Archive workspace'
    }
});

/** Props for {@link ArchiveWorkspaceDialog}. */
export type ArchiveWorkspaceDialogProps = {
    /** The workspace being archived, or `null` when the dialog is closed. */
    workspace: Pick<Workspace, 'id' | 'name'> | null;
    /** Close callback; ignored while the archive is in flight. */
    onClose: () => void;
    /** Runs the archive. */
    onConfirm: () => void;
    /** Whether the archive is in flight. */
    busy?: boolean;
    /** Where focus goes when it closes (Radix's `onCloseAutoFocus`). */
    onCloseAutoFocus?: (event: Event) => void;
};

/**
 * The archive confirmation that says what it does before the button: on open
 * it reads `GET /workspaces/:id/archive-impact` and lists what stays (records,
 * members) and who notices (workspaces linking its shared records). Archiving
 * is reversible and deletes nothing, so — unlike the delete dialog — a count
 * that cannot be read does not block it; the dialog says so instead.
 */
export function ArchiveWorkspaceDialog({
    workspace,
    onClose,
    onConfirm,
    busy = false,
    onCloseAutoFocus
}: ArchiveWorkspaceDialogProps) {
    const intl = useIntl();
    const open = workspace !== null;
    const impact = useArchiveImpact(workspace?.id ?? '', open);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onClose();
            }}
        >
            <DialogContent
                className="sm:max-w-[460px]"
                onCloseAutoFocus={onCloseAutoFocus}
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            name: workspace?.name ?? ''
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                {impact.isPending ? (
                    <SkeletonRegion
                        label={intl.formatMessage(messages.loading)}
                        className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
                    >
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/5" />
                    </SkeletonRegion>
                ) : impact.isError ? (
                    <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.loadError)}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
                        <li>
                            {'• '}
                            {intl.formatMessage(messages.records, {
                                count: impact.data.records
                            })}
                        </li>
                        <li>
                            {'• '}
                            {intl.formatMessage(messages.members, {
                                count: impact.data.members
                            })}
                        </li>
                        {impact.data.linkedWorkspaces > 0 ? (
                            <li>
                                {'• '}
                                {intl.formatMessage(messages.linked, {
                                    count: impact.data.linkedWorkspaces
                                })}
                            </li>
                        ) : null}
                    </ul>
                )}

                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.restoreHint)}
                </p>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button onClick={onConfirm} disabled={busy}>
                        {busy ? <Spinner /> : null}
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
