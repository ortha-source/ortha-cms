import { Outlet, useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Container,
    Skeleton
} from '@ortha-cms/design-system';
import { ApiError, HTTP_STATUS } from '@ortha-cms/utils-admin';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useUserDetail } from '../../api/useUserDetail';
import type { UserDetailContext } from '../../utils/userDetailContext';
import { BackLink } from '../BackLink';
import { MembersNoAccess } from '../MembersNoAccess';
import { UserHero } from './UserHero';
import { UserSideRail } from './UserSideRail';
import { UserStatsStrip } from './UserStatsStrip';

/** Intl descriptors for {@link UserDetailLayout}, co-located with the component. */
const messages = defineMessages({
    back: {
        id: 'users.detail.back',
        defaultMessage: 'Back to members'
    },
    notFound: {
        id: 'users.detail.notFound',
        defaultMessage: 'This member no longer exists.'
    },
    error: {
        id: 'users.detail.error',
        defaultMessage: 'Couldn’t load this member. Please try again.'
    }
});

/**
 * The user detail page shell, mounted at `/users/:id/*`. Fetches the member
 * once and shares it with every tab through the Outlet context, so a tab read
 * is free. Renders the back link, identity hero, stats strip, and the sticky
 * side rail beside the active tab. Loading shows skeletons; a 404 shows a
 * dedicated "no longer exists" state; any other error is retryable by the
 * tabs' own queries falling back here.
 *
 * Gated on `users:read` (the same permission the roster needs): without it the
 * page shows the shared no-access state and fetches nothing.
 */
export function UserDetailLayout() {
    const intl = useIntl();
    const { id = '' } = useParams();
    const canRead = useHasPermission('users:read');
    const { data: member, isPending, isError, error } = useUserDetail(
        id,
        canRead
    );

    if (!canRead) {
        return (
            <Container>
                <MembersNoAccess />
            </Container>
        );
    }

    const back = (
        <BackLink to="/users" label={intl.formatMessage(messages.back)} />
    );

    if (isPending) {
        return (
            <Container className="space-y-6">
                {back}
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </Container>
        );
    }

    if (isError) {
        const status = error instanceof ApiError ? error.status : null;
        const message =
            status === HTTP_STATUS.NOT_FOUND
                ? messages.notFound
                : messages.error;
        return (
            <Container className="space-y-6">
                {back}
                <Alert variant="destructive" role="alert">
                    <AlertDescription>
                        {intl.formatMessage(message)}
                    </AlertDescription>
                </Alert>
            </Container>
        );
    }

    const context: UserDetailContext = { member };

    return (
        <Container className="space-y-6">
            {back}
            <UserHero member={member} />
            <UserStatsStrip member={member} />
            <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
                <UserSideRail member={member} />
                {/*
                 * Key the tab subtree by member id so navigating straight from
                 * one member's detail to another's (e.g. the account menu's
                 * "My profile" from a roster member) remounts the active tab.
                 * Without this React reuses the same instance across the `:id`
                 * change — the layout never unmounts the Outlet when the target
                 * member is already cached (`isPending` stays false) — leaving a
                 * tab's `useState(member.…)` seeded from the previous member,
                 * which Save would then write back onto the wrong user.
                 */}
                <div key={member.id} className="min-w-0">
                    <Outlet context={context} />
                </div>
            </div>
        </Container>
    );
}
