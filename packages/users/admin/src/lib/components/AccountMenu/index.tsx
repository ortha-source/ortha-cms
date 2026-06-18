import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { LogOut, UserRound } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { avatarColorForId, initialsOf } from '@ortha-cms/utils-admin';
import { AuthStatus, useAuth, useLogoutMutation } from '@ortha-cms/identity-admin';
import { MemberAvatar } from '../MemberAvatar';

/** Intl descriptors for {@link AccountMenu}, co-located with the component. */
const messages = defineMessages({
    open: {
        id: 'users.account.open',
        defaultMessage: 'Account menu'
    },
    signedInAs: {
        id: 'users.account.signedInAs',
        defaultMessage: 'Signed in as'
    },
    myProfile: {
        id: 'users.account.myProfile',
        defaultMessage: 'My profile'
    },
    logout: {
        id: 'users.account.logout',
        defaultMessage: 'Logout'
    }
});

/**
 * The trailing toolbar account widget: an avatar button that opens a menu with
 * the signed-in user's name + email, a link to their own profile (the user
 * detail page), and a Logout action. Contributed to the shell's
 * `NAVBAR_END_SLOT`. Renders nothing until a user is resolved, so it never
 * flashes an empty avatar during the auth probe.
 */
export function AccountMenu() {
    const intl = useIntl();
    const navigate = useNavigate();
    const auth = useAuth();
    const logout = useLogoutMutation();

    if (auth.status !== AuthStatus.Authenticated) {
        return null;
    }

    const { id, email, name } = auth.user;
    const displayName = name ?? email;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="rounded-xl outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={intl.formatMessage(messages.open)}
            >
                <MemberAvatar
                    initials={initialsOf(displayName)}
                    color={avatarColorForId(id)}
                    className="size-8 text-xs"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                    <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.signedInAs)}
                    </p>
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {email}
                    </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate(`/users/${id}`)}>
                    <UserRound aria-hidden />
                    {intl.formatMessage(messages.myProfile)}
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={logout.isPending}
                    onSelect={() => logout.mutate()}
                >
                    <LogOut aria-hidden />
                    {intl.formatMessage(messages.logout)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
