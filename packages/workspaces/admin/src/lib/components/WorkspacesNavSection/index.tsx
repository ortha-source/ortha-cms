import { Link, useMatch } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { initialsOf } from '@ortha-cms/utils-admin';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@ortha-cms/design-system';
import { useWorkspaces } from '../../api/useWorkspaces';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import type { Workspace } from '../../types/workspace';

/** Intl descriptors for {@link WorkspacesNavSection}, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'workspaces.sidebar.heading',
        defaultMessage: 'Workspaces'
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

    const active = (workspaces ?? []).filter(
        (workspace) => workspace.status === 'Active'
    );
    if (active.length === 0) {
        return null;
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel>
                {intl.formatMessage(messages.heading)}
            </SidebarGroupLabel>
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
        </SidebarGroup>
    );
}
