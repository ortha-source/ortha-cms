import { defineMessages, useIntl } from 'react-intl';
import {
    WORKSPACE_SIDEBAR_SLOT,
    type WorkspaceNavItem
} from '../../../slots/workspaceSlots';
import { WorkspaceSidebarButton } from '../WorkspaceSidebarButton';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import type { Workspace } from '../../../types/workspace';

/** Intl descriptors for the workspace rail, co-located here. */
const messages = defineMessages({
    nav: {
        id: 'workspaces.rail.nav',
        defaultMessage: 'Workspace sections'
    }
});

/** Sorts a slot's contributed items by ascending `order`. */
function byOrder(items: WorkspaceNavItem[]): WorkspaceNavItem[] {
    return items.slice().sort((a, b) => a.order - b.order);
}

type WorkspaceRailProps = {
    /** The workspace currently open. */
    current: Workspace;
    /** Every workspace the switcher can jump to. */
    workspaces: Workspace[];
};

/**
 * The workspace's compact left icon rail: the workspace switcher up top, a
 * divider, then the section nav ({@link WORKSPACE_SIDEBAR_SLOT}, e.g. Content /
 * Media / Insights / Settings). Creating a workspace lives in the switcher
 * popover, so the rail carries no bottom action. Sticky under the shell's 48px
 * navbar (nested chrome); off-white so it reads as chrome, not canvas.
 */
export function WorkspaceRail({ current, workspaces }: WorkspaceRailProps) {
    const intl = useIntl();
    const sections = byOrder(WORKSPACE_SIDEBAR_SLOT.getItems());

    return (
        <div className="sticky top-12 flex h-[calc(100svh-3rem)] w-14 shrink-0 flex-col items-center gap-1.5 self-start border-r border-border bg-[oklch(0.985_0_0)] py-2.5">
            <WorkspaceSwitcher current={current} workspaces={workspaces} />
            <div aria-hidden className="my-1 h-px w-7 bg-border" />
            <nav
                aria-label={intl.formatMessage(messages.nav)}
                className="flex flex-col items-center gap-2"
            >
                {sections.map((item) => (
                    <WorkspaceSidebarButton key={item.to} item={item} />
                ))}
            </nav>
        </div>
    );
}
