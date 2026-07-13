import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft } from 'lucide-react';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu
} from '@ortha-cms/design-system';
import { SidebarSearch } from '@ortha-cms/shell-admin';
import { useWorkspaces } from '../../api/useWorkspaces';
import {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_SECTION_SLOT
} from '../../slots/workspaceSlots';
import { WorkspaceNavButton } from './WorkspaceNavButton';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import type { Workspace } from '../../types/workspace';

/** Intl descriptors for the workspace sidebar nav, co-located here. */
const messages = defineMessages({
    back: {
        id: 'workspaces.nav.back',
        defaultMessage: 'Ortha CMS'
    },
    workspaceGroup: {
        id: 'workspaces.nav.groupLabel',
        defaultMessage: 'Workspace'
    }
});

/** Sorts a slot's items by ascending `order`. */
function byOrder<T extends { order: number }>(items: T[]): T[] {
    return items.slice().sort((a, b) => a.order - b.order);
}

/**
 * The per-workspace sidebar content, injected into the app sidebar's contextual
 * region by {@link WorkspaceShell} while a workspace is open. It replaces the
 * global nav with: a back link to the top-level app, the workspace switcher, a
 * search trigger, any custom sections (the Content Library's content-type list,
 * from {@link WORKSPACE_SECTION_SLOT}), and the "Workspace" section (Media,
 * Insights, Settings, from {@link WORKSPACE_NAV_SLOT}). The persistent account
 * footer stays below, owned by the shell.
 */
export function WorkspaceNav({ workspace }: { workspace: Workspace }) {
    const intl = useIntl();
    const { data: workspaces = [] } = useWorkspaces();
    const sections = byOrder(WORKSPACE_SECTION_SLOT.getItems());
    const navItems = byOrder(WORKSPACE_NAV_SLOT.getItems());

    return (
        <>
            <SidebarHeader className="gap-2 px-2 pt-2">
                <Link
                    to="/"
                    className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" aria-hidden />
                    {intl.formatMessage(messages.back)}
                </Link>
                <WorkspaceSwitcher
                    current={workspace}
                    workspaces={workspaces}
                />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarSearch />
                </SidebarGroup>
                {sections.map(({ id, Component }) => (
                    <Component key={id} />
                ))}
                {navItems.length > 0 ? (
                    <SidebarGroup>
                        <SidebarGroupLabel>
                            {intl.formatMessage(messages.workspaceGroup)}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <nav
                                aria-label={intl.formatMessage(
                                    messages.workspaceGroup
                                )}
                            >
                                <SidebarMenu>
                                    {navItems.map((item) => (
                                        <WorkspaceNavButton
                                            key={item.to}
                                            item={item}
                                        />
                                    ))}
                                </SidebarMenu>
                            </nav>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : null}
            </SidebarContent>
        </>
    );
}
