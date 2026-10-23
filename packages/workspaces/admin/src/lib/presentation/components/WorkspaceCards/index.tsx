import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { useJustCreated } from '@orthacms/utils-admin';
import type { Workspace } from '../../../domain/types/workspace';
import { WORKSPACES_SCOPE } from '../../../application/useCreateWorkspace';
import { WorkspaceCard } from './WorkspaceCard';

const messages = defineMessages({
    label: { id: 'workspaces.table.caption', defaultMessage: 'Workspaces' },
    create: {
        id: 'workspaces.page.newWorkspace',
        defaultMessage: 'New workspace'
    },
    createHint: {
        id: 'workspaces.card.createHint',
        defaultMessage: 'Name it, pick its content types, invite people'
    }
});

type WorkspaceCardsProps = {
    workspaces: Workspace[];
    /** Offer the trailing "New workspace" card (`workspaces:create`). */
    canCreate: boolean;
};

/**
 * The workspaces as a grid of cards — one per workspace, then a dashed
 * "New workspace" card for whoever may create one.
 */
export function WorkspaceCards({ workspaces, canCreate }: WorkspaceCardsProps) {
    const intl = useIntl();
    const isJustCreated = useJustCreated(WORKSPACES_SCOPE);

    return (
        <ul
            aria-label={intl.formatMessage(messages.label)}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
            {workspaces.map((workspace) => (
                <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    justCreated={isJustCreated(workspace.id)}
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
    );
}
