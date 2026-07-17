import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    cn
} from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import { WorkspaceAvatar } from '../../WorkspaceAvatar';
import { WORKSPACES_CREATE } from '../../../utils/permissions';
import type { Workspace } from '../../../types/workspace';

/** Intl descriptors for the sidebar workspace switcher, co-located here. */
const messages = defineMessages({
    trigger: {
        id: 'workspaces.switcher.trigger',
        defaultMessage: 'Switch workspace, current: {name}'
    },
    role: {
        id: 'workspaces.switcher.role',
        defaultMessage: 'Workspace'
    },
    heading: {
        id: 'workspaces.switcher.heading',
        defaultMessage: 'Switch workspace'
    },
    sub: {
        id: 'workspaces.switcher.sub',
        defaultMessage:
            '{count, plural, one {# member} other {# members}} · {status}'
    },
    create: {
        id: 'workspaces.switcher.create',
        defaultMessage: 'New workspace'
    }
});

type WorkspaceSwitcherProps = {
    /** The workspace currently open. */
    current: Workspace;
    /** Every workspace the switcher can jump to. */
    workspaces: Workspace[];
};

/**
 * The workspace sidebar's header control: a full-width row showing the current
 * workspace (avatar + name + "Workspace" label) that opens a popover listing
 * every workspace to jump to, plus a "New workspace" action. Switching
 * navigates to the target's base, which redirects to its first section.
 */
export function WorkspaceSwitcher({
    current,
    workspaces
}: WorkspaceSwitcherProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const canCreate = useHasPermission(WORKSPACES_CREATE);
    const [open, setOpen] = useState(false);

    const go = (path: string) => {
        setOpen(false);
        navigate(path);
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            aria-label={intl.formatMessage(messages.trigger, {
                                name: current.name
                            })}
                        >
                            <WorkspaceAvatar
                                initials={initialsOf(current.name)}
                                color={current.color}
                                className="size-8 rounded-lg text-xs"
                            />
                            <span className="flex min-w-0 flex-1 flex-col text-left">
                                <span className="truncate text-sm font-semibold">
                                    {current.name}
                                </span>
                                <span className="truncate text-xs text-sidebar-foreground/70">
                                    {intl.formatMessage(messages.role)}
                                </span>
                            </span>
                            <ChevronsUpDown className="ml-auto" aria-hidden />
                        </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-[--radix-popover-trigger-width] min-w-64 p-2"
                    >
                        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                            {intl.formatMessage(messages.heading)}
                        </p>
                        {workspaces.map((workspace) => {
                            const isCurrent = workspace.id === current.id;
                            return (
                                <button
                                    key={workspace.id}
                                    type="button"
                                    onClick={() =>
                                        go(`/workspaces/${workspace.id}`)
                                    }
                                    className={cn(
                                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent',
                                        isCurrent && 'bg-accent'
                                    )}
                                >
                                    <WorkspaceAvatar
                                        initials={initialsOf(workspace.name)}
                                        color={workspace.color}
                                        className="size-7 shrink-0 rounded-md text-[11px]"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13.5px] font-medium">
                                            {workspace.name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {intl.formatMessage(messages.sub, {
                                                count: workspace.members.length,
                                                status: workspace.status
                                            })}
                                        </span>
                                    </span>
                                    {isCurrent ? (
                                        <Check className="size-4 shrink-0 text-muted-foreground" />
                                    ) : null}
                                </button>
                            );
                        })}
                        {canCreate ? (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => go('/workspaces/new')}
                                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                                >
                                    <span
                                        aria-hidden
                                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                                    >
                                        <Plus className="size-4" />
                                    </span>
                                    <span className="text-[13.5px] font-medium">
                                        {intl.formatMessage(messages.create)}
                                    </span>
                                </button>
                            </>
                        ) : null}
                    </PopoverContent>
                </Popover>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
