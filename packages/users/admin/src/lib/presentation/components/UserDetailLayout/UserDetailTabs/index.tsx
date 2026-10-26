import { NavLink } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { TabNav, TabNavLink } from '@orthacms/design-system';
import {
    AuthStatus,
    useAuth,
    useHasPermission
} from '@orthacms/identity-admin';
import type { Member } from '../../../../domain/types/member';

/** Intl descriptors for {@link UserDetailTabs}, co-located with the component. */
const messages = defineMessages({
    overview: { id: 'users.detail.tab.overview', defaultMessage: 'Overview' },
    workspaces: {
        id: 'users.detail.tab.workspaces',
        defaultMessage: 'Workspaces'
    },
    access: {
        id: 'users.detail.tab.access',
        defaultMessage: 'Sessions & access'
    },
    activity: { id: 'users.detail.tab.activity', defaultMessage: 'Activity' },
    preferences: {
        id: 'users.detail.tab.preferences',
        defaultMessage: 'Preferences'
    },
    nav: { id: 'users.detail.tab.nav', defaultMessage: 'Member sections' }
});

/** One tab: an absolute-path `NavLink` whose active state underlines it. */
function UserDetailTab({ to, label }: { to: string; label: string }) {
    return (
        <TabNavLink asChild>
            <NavLink to={to}>{label}</NavLink>
        </TabNavLink>
    );
}

/**
 * The member page's tabs — **four instead of seven**: Overview (profile,
 * recent activity and summaries), Workspaces, Sessions & access (sessions,
 * the password link and suspension, which used to be three tabs), and
 * Activity. Role moved to the header's dialog.
 *
 * Sessions & access needs `users:update` and Activity `activity:read`; without
 * the permission the tab is hidden and its route redirects to Overview, so a
 * read-only viewer never meets a dead link. **Preferences** (the colour theme)
 * is the signed-in person's own setting, so it appears only on their own page
 * — everyone else's has the four.
 */
export function UserDetailTabs({ member }: { member: Member }) {
    const intl = useIntl();
    const canManage = useHasPermission('users:update');
    const canReadActivity = useHasPermission('activity:read');
    const auth = useAuth();
    const isSelf =
        auth.status === AuthStatus.Authenticated && auth.user.id === member.id;
    const base = `/users/${member.id}`;

    return (
        <TabNav aria-label={intl.formatMessage(messages.nav)}>
            <UserDetailTab
                to={`${base}/overview`}
                label={intl.formatMessage(messages.overview)}
            />
            <UserDetailTab
                to={`${base}/workspaces`}
                label={intl.formatMessage(messages.workspaces)}
            />
            {canManage ? (
                <UserDetailTab
                    to={`${base}/access`}
                    label={intl.formatMessage(messages.access)}
                />
            ) : null}
            {canReadActivity ? (
                <UserDetailTab
                    to={`${base}/activity`}
                    label={intl.formatMessage(messages.activity)}
                />
            ) : null}
            {isSelf ? (
                <UserDetailTab
                    to={`${base}/preferences`}
                    label={intl.formatMessage(messages.preferences)}
                />
            ) : null}
        </TabNav>
    );
}
