import { defineMessages, useIntl } from 'react-intl';
import {
    FileStack,
    SlidersHorizontal,
    TriangleAlert,
    Users
} from 'lucide-react';
import { byOrder } from '@orthacms/utils-admin';
import { WORKSPACE_SETTINGS_TAB_SLOT } from '../../slots/workspaceSlots';
import { SettingsNavItem } from './SettingsNavItem';
import { SettingsNavLink } from './SettingsNavLink';

/** Intl descriptors for {@link WorkspaceSettingsNav}, co-located here. */
const messages = defineMessages({
    nav: {
        id: 'workspaces.settings.rail.nav',
        defaultMessage: 'Workspace settings sections'
    },
    heading: {
        id: 'workspaces.settings.rail.heading',
        defaultMessage: 'Settings'
    },
    general: {
        id: 'workspaces.settings.rail.general',
        defaultMessage: 'General'
    },
    members: {
        id: 'workspaces.settings.rail.members',
        defaultMessage: 'Members'
    },
    content: {
        id: 'workspaces.settings.rail.contentTypes',
        defaultMessage: 'Content types'
    },
    danger: {
        id: 'workspaces.settings.rail.danger',
        defaultMessage: 'Danger zone'
    }
});

/**
 * The settings page's section nav — a column beside the section on a wide
 * work area, a scrolling row above it on a narrow one. A `<nav>` of links,
 * not a tablist: each section is its own route, every entry is a tab stop and
 * Enter follows it. Content types and Members carry their counts.
 *
 * Plugin-contributed sections ({@link WORKSPACE_SETTINGS_TAB_SLOT}) sit
 * **between Members and Danger zone**, each through a {@link SettingsNavLink}
 * that gates itself on its permission. The Danger zone is last, ruled off and
 * red, and listed only when the user can act on it (its route redirects away
 * otherwise), so a read-only viewer never sees a dead link.
 */
export function WorkspaceSettingsNav({
    workspaceId,
    showDanger,
    contentCount,
    memberCount
}: {
    /** The open workspace id — the base for every link. */
    workspaceId: string;
    /** Whether to show the Danger-zone entry (update or delete permission). */
    showDanger: boolean;
    /** How many content grants the workspace holds, own and shared. */
    contentCount: number;
    /** How many members it has. */
    memberCount: number;
}) {
    const intl = useIntl();
    const base = `/workspaces/${workspaceId}/settings`;
    // `byOrder` sorts a copy: the slot's own array is shared (and frozen), so
    // an in-place `sort()` here would throw.
    const contributed = byOrder(WORKSPACE_SETTINGS_TAB_SLOT.getItems());

    return (
        <nav
            aria-label={intl.formatMessage(messages.nav)}
            className="flex min-w-0 gap-0.5 overflow-x-auto lg:sticky lg:top-6 lg:w-[184px] lg:shrink-0 lg:flex-col lg:self-start lg:overflow-visible lg:pt-1"
        >
            <span
                aria-hidden
                className="hidden px-2.5 pb-2 text-xs font-medium text-muted-foreground lg:block"
            >
                {intl.formatMessage(messages.heading)}
            </span>
            <SettingsNavItem
                to={`${base}/general`}
                icon={SlidersHorizontal}
                label={intl.formatMessage(messages.general)}
            />
            <SettingsNavItem
                to={`${base}/content`}
                icon={FileStack}
                label={intl.formatMessage(messages.content)}
                count={contentCount}
            />
            <SettingsNavItem
                to={`${base}/members`}
                icon={Users}
                label={intl.formatMessage(messages.members)}
                count={memberCount}
            />
            {contributed.map((tab) => (
                <SettingsNavLink key={tab.id} base={base} tab={tab} />
            ))}
            {showDanger ? (
                <>
                    <span
                        aria-hidden
                        className="mx-1 w-px shrink-0 self-stretch bg-border lg:mx-2.5 lg:my-2 lg:h-px lg:w-auto"
                    />
                    <SettingsNavItem
                        to={`${base}/danger`}
                        icon={TriangleAlert}
                        label={intl.formatMessage(messages.danger)}
                        destructive
                    />
                </>
            ) : null}
        </nav>
    );
}
