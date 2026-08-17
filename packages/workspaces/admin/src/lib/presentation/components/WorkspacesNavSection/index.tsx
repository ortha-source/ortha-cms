import { Link, useMatch } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, Plus } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { initialsOf } from '@ortha-cms/utils-admin';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
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
 *
 * The heading doubles as a **collapse trigger** (Radix `Collapsible`, so
 * `aria-expanded` + `data-state` come for free), open by default: with a long
 * membership the list crowded out the sections below it in the sidebar. With no
 * rows to reveal — loading, or create permission but no workspaces yet — the
 * heading stays a plain label and no `Collapsible` is rendered at all.
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

    const heading = intl.formatMessage(messages.heading);
    const newWorkspace = intl.formatMessage(messages.newWorkspace);
    const createAction = canCreate ? (
        <SidebarGroupAction asChild title={newWorkspace}>
            <Link to="/workspaces/new" aria-label={newWorkspace}>
                <Plus />
            </Link>
        </SidebarGroupAction>
    ) : null;

    // Nothing to reveal (create permission but no workspaces yet, and every
    // moment the list query is still in flight) → a plain heading, no
    // Collapsible at all. Two reasons, and the second is the load-bearing one:
    //
    // 1. A disclosure whose body is empty is not a control.
    // 2. Radix puts `aria-controls={contentId}` on the trigger **whenever it is
    //    open** — and this group is `defaultOpen`. With the content not
    //    mounted that idref dangles, which axe flags as `aria-valid-attr-value`
    //    (critical) on every page carrying the sidebar. Marking the trigger
    //    `disabled` does not help: Radix keys the attribute off `open`, not off
    //    `disabled`. The closed case is safe for the same reason — closed means
    //    no `aria-controls` at all.
    if (active.length === 0) {
        return (
            <SidebarGroup>
                <SidebarGroupLabel>{heading}</SidebarGroupLabel>
                {createAction}
            </SidebarGroup>
        );
    }

    return (
        // `defaultOpen`: the quick-list is a primary nav aid, so it starts
        // expanded and the collapse is an opt-out. The choice is deliberately
        // **not** persisted — the shell already owns one cookie-backed sidebar
        // state, and a second, per-section one is scope this section doesn't
        // need.
        <Collapsible defaultOpen className="group/workspaces">
            <SidebarGroup>
                {/* `asChild`: `SidebarGroupLabel` is a <div>, so wrapping it in
                    a trigger without this would nest a div inside a button.
                    `w-fit` keeps the trigger's hit area clear of the "+"
                    action, which `SidebarGroupAction` positions absolutely over
                    the right-hand end of this same row. */}
                <SidebarGroupLabel
                    asChild
                    className="w-fit gap-1 pr-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-3.5"
                >
                    <CollapsibleTrigger>
                        <ChevronRight
                            aria-hidden
                            className="transition-transform duration-200 group-data-[state=open]/workspaces:rotate-90"
                        />
                        {heading}
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                {createAction}
                {/* Mounted unconditionally, which is what keeps the trigger's
                    `aria-controls` pointing at something real. Radix still
                    unmounts it while *closed*, so the collapsed rows are not
                    merely invisible — they leave the tab order and the
                    accessibility tree, and the <nav> landmark goes with them
                    rather than being left empty; the trigger drops
                    `aria-controls` in that same state. */}
                <CollapsibleContent>
                    <SidebarGroupContent>
                        <nav aria-label={heading}>
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
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
