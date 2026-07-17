import { Link, useMatch } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { initialsOf } from '@ortha-cms/utils-admin';
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@ortha-cms/design-system';
import { useWorkspaces } from '../../../application/useWorkspaces';
import { isActiveWorkspace } from '../../../domain/isActiveWorkspace';
import { WORKSPACES_CREATE } from '../../../domain/permissions';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import type { Workspace } from '../../../domain/types/workspace';

/** Intl descriptors for {@link WorkspacesNavSection}, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'workspaces.sidebar.heading',
        defaultMessage: 'Workspaces'
    },
    newWorkspace: {
        id: 'workspaces.sidebar.newWorkspace',
        defaultMessage: 'New workspace'
    }
});

/** One workspace row: a link to the workspace, active on any of its sub-paths. */
function WorkspaceNavRow({ workspace }: { workspace: Workspace }) {
    const match = useMatch(`/workspaces/${workspace.id}/*`);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={Boolean(match)}
                tooltip={workspace.name}
            >
                <Link
                    to={`/workspaces/${workspace.id}`}
                    aria-current={match ? 'page' : undefined}
                >
                    <WorkspaceAvatar
                        initials={initialsOf(workspace.name)}
                        color={workspace.color}
                        className="size-5 rounded-[5px] text-[10px]"
                    />
                    <span>{workspace.name}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

/**
 * The "Workspaces" quick-list in the global sidebar: the active workspaces as
 * direct links, so a member can jump into one without the Workspaces list page.
 * Contributed to the shell's `SIDEBAR_SECTION_SLOT` by `workspaces-admin`.
 * Renders nothing while loading or when there are no active workspaces, so it
 * never shows an empty section.
 */
export function WorkspacesNavSection() {
    const intl = useIntl();
    const { data: workspaces } = useWorkspaces();
    const canCreate = useHasPermission(WORKSPACES_CREATE);

    const active = (workspaces ?? []).filter(isActiveWorkspace);
    // Nothing to show and nothing to do → skip the section entirely. With create
    // permission we still show it (the "+" invites creating the first one).
    if (active.length === 0 && !canCreate) {
        return null;
    }

    const newWorkspace = intl.formatMessage(messages.newWorkspace);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>
                {intl.formatMessage(messages.heading)}
            </SidebarGroupLabel>
            {canCreate ? (
                <SidebarGroupAction asChild title={newWorkspace}>
                    <Link to="/workspaces/new" aria-label={newWorkspace}>
                        <Plus />
                    </Link>
                </SidebarGroupAction>
            ) : null}
            {active.length > 0 ? (
                <SidebarGroupContent>
                    <nav aria-label={intl.formatMessage(messages.heading)}>
                        <SidebarMenu>
                            {active.map((workspace) => (
                                <WorkspaceNavRow
                                    key={workspace.id}
                                    workspace={workspace}
                                />
                            ))}
                        </SidebarMenu>
                    </nav>
                </SidebarGroupContent>
            ) : null}
        </SidebarGroup>
    );
}
