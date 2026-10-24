import { useState } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { useJustCreated } from '@orthacms/utils-admin';
import { toast } from '@orthacms/design-system';
import type { Workspace } from '../../../domain/types/workspace';
import { WORKSPACES_SCOPE } from '../../../application/useCreateWorkspace';
import { useSetWorkspaceStatus } from '../../../application/useSetWorkspaceStatus';
import { ArchiveWorkspaceDialog } from '../ArchiveWorkspaceDialog';
import { WorkspaceCard } from './WorkspaceCard';

const messages = defineMessages({
    label: { id: 'workspaces.table.caption', defaultMessage: 'Workspaces' },
    create: {
        id: 'workspaces.page.newWorkspace',
        defaultMessage: 'New workspace'
    },
    createHint: {
        id: 'workspaces.card.createHint',
        defaultMessage: 'Name it, pick its content, invite people'
    },
    archived: {
        id: 'workspaces.card.archivedToast',
        defaultMessage: '{name} archived.'
    },
    restored: {
        id: 'workspaces.card.restoredToast',
        defaultMessage: '{name} restored.'
    },
    statusError: {
        id: 'workspaces.card.statusError',
        defaultMessage: 'Couldn’t change {name}. Please try again.'
    }
});

type WorkspaceCardsProps = {
    workspaces: Workspace[];
    /** Offer the trailing "New workspace" card (`workspaces:create`). */
    canCreate: boolean;
    /** Offer Archive and Restore (`workspaces:update`). */
    canUpdate: boolean;
};

/**
 * The workspaces as a grid of cards — one per workspace, then a dashed
 * "New workspace" card for whoever may create one. Owns the one archive
 * confirmation the cards' ⋯ menus open, and Restore, which applies directly:
 * bringing a workspace back is low-risk, the same asymmetry the settings page
 * keeps.
 */
export function WorkspaceCards({
    workspaces,
    canCreate,
    canUpdate
}: WorkspaceCardsProps) {
    const intl = useIntl();
    const isJustCreated = useJustCreated(WORKSPACES_SCOPE);
    const setStatus = useSetWorkspaceStatus();
    const [archiving, setArchiving] = useState<Workspace | null>(null);

    const change = async (
        workspace: Workspace,
        status: Workspace['status']
    ) => {
        try {
            await setStatus.mutateAsync({ id: workspace.id, status });
            toast.success(
                intl.formatMessage(
                    status === 'Archived'
                        ? messages.archived
                        : messages.restored,
                    { name: workspace.name }
                )
            );
        } catch {
            toast.error(
                intl.formatMessage(messages.statusError, {
                    name: workspace.name
                })
            );
        }
    };

    return (
        <>
            <ul
                aria-label={intl.formatMessage(messages.label)}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
                {workspaces.map((workspace) => (
                    <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        justCreated={isJustCreated(workspace.id)}
                        canUpdate={canUpdate}
                        onArchive={() => setArchiving(workspace)}
                        onRestore={() => change(workspace, 'Active')}
                        statusPending={
                            setStatus.isPending &&
                            setStatus.variables?.id === workspace.id
                        }
                    />
                ))}
                {canCreate ? (
                    <li className="flex">
                        <Link
                            to="/workspaces/new"
                            className="flex min-h-[176px] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Plus aria-hidden className="size-4" />
                            <span className="font-medium text-foreground">
                                {intl.formatMessage(messages.create)}
                            </span>
                            <span className="text-xs">
                                {intl.formatMessage(messages.createHint)}
                            </span>
                        </Link>
                    </li>
                ) : null}
            </ul>

            <ArchiveWorkspaceDialog
                workspace={archiving}
                busy={setStatus.isPending}
                onClose={() => setArchiving(null)}
                onConfirm={async () => {
                    if (!archiving) return;
                    await change(archiving, 'Archived');
                    setArchiving(null);
                }}
            />
        </>
    );
}
