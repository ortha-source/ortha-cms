import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Activity,
    Ban,
    Building2,
    MonitorSmartphone,
    ShieldCheck,
    UserRound
} from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import type { Member } from '../../../types/member';

/** Intl descriptors for {@link UserSideRail}, co-located with the component. */
const messages = defineMessages({
    account: { id: 'users.detail.rail.account', defaultMessage: 'Account' },
    audit: { id: 'users.detail.rail.audit', defaultMessage: 'Audit' },
    access: { id: 'users.detail.rail.access', defaultMessage: 'Access' },
    general: { id: 'users.detail.rail.general', defaultMessage: 'General' },
    role: { id: 'users.detail.rail.role', defaultMessage: 'Role' },
    workspaces: {
        id: 'users.detail.rail.workspaces',
        defaultMessage: 'Workspaces'
    },
    sessions: { id: 'users.detail.rail.sessions', defaultMessage: 'Sessions' },
    activity: { id: 'users.detail.rail.activity', defaultMessage: 'Activity' },
    signInAccess: {
        id: 'users.detail.rail.signInAccess',
        defaultMessage: 'Sign-in access'
    },
    disabled: { id: 'users.detail.rail.disabled', defaultMessage: 'Disabled' },
    nav: { id: 'users.detail.rail.nav', defaultMessage: 'User detail sections' }
});

type RailIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/** One navigation link in the rail; active state mirrors the open tab. */
function RailItem({
    to,
    icon: Icon,
    label,
    trailing
}: {
    to: string;
    icon: RailIcon;
    label: string;
    trailing?: string;
}) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )
            }
        >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {trailing ? (
                <span className="text-xs text-muted-foreground">{trailing}</span>
            ) : null}
        </NavLink>
    );
}

/** A labelled group of rail items. */
function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

/**
 * The detail page's sticky left navigation. Account sections are always shown;
 * the Audit (Sessions, Activity) and Access groups are gated — without the
 * permission the item is hidden and its route redirects away, so a read-only
 * admin never sees a dead link. Links are absolute (`/users/:id/...`) so active
 * state is unambiguous regardless of the matched tab.
 */
export function UserSideRail({ member }: { member: Member }) {
    const intl = useIntl();
    const canManage = useHasPermission('users:update');
    const canReadActivity = useHasPermission('activity:read');
    const base = `/users/${member.id}`;

    return (
        <nav
            aria-label={intl.formatMessage(messages.nav)}
            className="space-y-5 md:sticky md:top-6 md:self-start"
        >
            <RailGroup label={intl.formatMessage(messages.account)}>
                <RailItem
                    to={`${base}/general`}
                    icon={UserRound}
                    label={intl.formatMessage(messages.general)}
                />
                <RailItem
                    to={`${base}/roles`}
                    icon={ShieldCheck}
                    label={intl.formatMessage(messages.role)}
                />
                <RailItem
                    to={`${base}/workspaces`}
                    icon={Building2}
                    label={intl.formatMessage(messages.workspaces)}
                />
            </RailGroup>

            {canManage || canReadActivity ? (
                <RailGroup label={intl.formatMessage(messages.audit)}>
                    {canManage ? (
                        <RailItem
                            to={`${base}/sessions`}
                            icon={MonitorSmartphone}
                            label={intl.formatMessage(messages.sessions)}
                        />
                    ) : null}
                    {canReadActivity ? (
                        <RailItem
                            to={`${base}/activity`}
                            icon={Activity}
                            label={intl.formatMessage(messages.activity)}
                        />
                    ) : null}
                </RailGroup>
            ) : null}

            {canManage ? (
                <RailGroup label={intl.formatMessage(messages.access)}>
                    <RailItem
                        to={`${base}/access`}
                        icon={Ban}
                        label={intl.formatMessage(messages.signInAccess)}
                        trailing={
                            member.status === 'disabled'
                                ? intl.formatMessage(messages.disabled)
                                : undefined
                        }
                    />
                </RailGroup>
            ) : null}
        </nav>
    );
}
