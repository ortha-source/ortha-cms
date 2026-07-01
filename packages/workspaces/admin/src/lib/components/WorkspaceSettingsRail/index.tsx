import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { FileStack, SlidersHorizontal, TriangleAlert, Users } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';

/** Intl descriptors for {@link WorkspaceSettingsRail}, co-located here. */
const messages = defineMessages({
    nav: {
        id: 'workspaces.settings.rail.nav',
        defaultMessage: 'Workspace settings sections'
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
        id: 'workspaces.settings.rail.content',
        defaultMessage: 'Content'
    },
    danger: {
        id: 'workspaces.settings.rail.danger',
        defaultMessage: 'Danger zone'
    }
});

type RailIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** One rail entry: an absolute-path `NavLink` whose active state fills it. */
type RailEntry = {
    /** Absolute route the entry links to. */
    to: string;
    /** Leading icon. */
    icon: RailIcon;
    /** Localized label. */
    label: string;
};

/**
 * The settings page's sticky left navigation — mirrors the user-detail side
 * rail. Absolute links (`/workspaces/:id/settings/...`) so active state is
 * unambiguous. The Danger-zone entry is included only when the user can act on
 * it (its route redirects away otherwise), so a read-only viewer never sees a
 * dead link.
 */
export function WorkspaceSettingsRail({
    workspaceId,
    showDanger
}: {
    /** The open workspace id — the base for every link. */
    workspaceId: string;
    /** Whether to show the Danger-zone entry (update or delete permission). */
    showDanger: boolean;
}) {
    const intl = useIntl();
    const base = `/workspaces/${workspaceId}/settings`;

    const entries: RailEntry[] = [
        {
            to: `${base}/general`,
            icon: SlidersHorizontal,
            label: intl.formatMessage(messages.general)
        },
        {
            to: `${base}/members`,
            icon: Users,
            label: intl.formatMessage(messages.members)
        },
        {
            to: `${base}/content`,
            icon: FileStack,
            label: intl.formatMessage(messages.content)
        },
        ...(showDanger
            ? [
                  {
                      to: `${base}/danger`,
                      icon: TriangleAlert,
                      label: intl.formatMessage(messages.danger)
                  }
              ]
            : [])
    ];

    return (
        <nav
            aria-label={intl.formatMessage(messages.nav)}
            className="flex gap-1 overflow-x-auto md:sticky md:top-6 md:flex-col md:self-start md:overflow-visible"
        >
            {entries.map(({ to, icon: Icon, label }) => (
                <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                        cn(
                            'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            isActive
                                ? 'bg-muted font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )
                    }
                >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
