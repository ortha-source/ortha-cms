import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { defineMessages, useIntl } from 'react-intl';
import { toast } from '@ortha-cms/design-system';
import { setUnauthorizedHandler } from '@ortha-cms/utils-admin';
import {
    currentUserKey,
    useCurrentUser
} from '../../../application/useCurrentUser';
import { markSessionEnded } from '../../../application/sessionEnded';
import {
    AuthProviderContext,
    AuthStatus,
    type AuthState
} from '../authContext';

/** Intl descriptors for {@link AuthProvider}, co-located with the component. */
const messages = defineMessages({
    sessionEnded: {
        id: 'identity.auth.sessionEnded',
        defaultMessage: 'Your session has ended. Please sign in again.'
    }
});

/** What {@link AuthProvider} reads off the current-user query. */
type CurrentUserQuery = ReturnType<typeof useCurrentUser>;

/**
 * Maps the probe's query state onto the published {@link AuthState}.
 *
 * `data` present → authenticated. Otherwise, while a probe is in flight — the
 * initial load or a post-login/logout refetch — hold in `loading` so the gate
 * doesn't redirect on the stale "no user" gap between invalidating the query
 * and the fresh response landing.
 *
 * A settled probe then splits two ways, and the split matters: the gateway
 * turns a `401` into `data === null` (nobody is signed in — the ordinary signed
 * out state), and rethrows everything else. A `500`, a timeout or a dropped
 * connection therefore lands on `unavailable`, not `unauthenticated`, because
 * it tells us nothing about the session. Treating the two alike is what made an
 * API outage sign a perfectly valid session out.
 */
function toAuthState({
    data,
    isPending,
    isFetching,
    isError
}: CurrentUserQuery): AuthState {
    if (data) {
        return {
            status: AuthStatus.Authenticated,
            user: {
                id: data.id,
                email: data.email,
                name: data.name,
                permissions: data.permissions
            }
        };
    }
    if (isPending || isFetching) {
        return { status: AuthStatus.Loading, user: null };
    }
    if (isError) {
        return { status: AuthStatus.Unavailable, user: null };
    }
    return { status: AuthStatus.Unauthenticated, user: null };
}

/**
 * Resolves the current user via `GET /api/auth/me` and publishes it into the
 * auth context, so {@link RequireAuth} can gate routes. The shell composes this
 * around `RequireAuth` in its `layout`, so it wraps the private area (not the
 * public sign-in page); the host renders that layout without knowing any of this
 * exists.
 *
 * It also owns the **session-lost** reaction: while mounted it installs the
 * shared client's `401` handler, so a session that dies mid-visit — revoked from
 * another device, expired, or the account suspended by an admin — drops the
 * cached user and lands the visitor on the sign-in page instead of leaving a
 * shell that 401s on every request.
 *
 * And it **says so**, which is the part the redirect alone never did. React
 * Router replaces the whole view with the sign-in page: focus was on a control
 * that no longer exists so the browser resets it to `<body>`, a screen reader's
 * virtual buffer still holds the unmounted page, and anything typed into a form
 * is gone — with no message anywhere explaining why (WCAG 4.1.3 Status
 * Messages, 2.4.3 Focus Order). The toast is a real announcement in the host's
 * live region and survives the route change; the flag it sets is what lets the
 * sign-in page repeat the explanation in a place the visitor can still read
 * after the toast has gone.
 *
 * The transport seam stays meaning-free on purpose — `setUnauthorizedHandler`
 * exists so `utils-admin` does not decide what a `401` means, and that package
 * owns no user-facing strings — so the message belongs here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const currentUser = useCurrentUser();
    const queryClient = useQueryClient();
    const intl = useIntl();

    useEffect(() => {
        setUnauthorizedHandler(() => {
            // Whether anyone was signed in a moment ago, read BEFORE the write
            // below clears it. A cached user is what separates "the session you
            // were using has ended" from the ordinary signed-out state a
            // background request can also produce, and announcing the first
            // over the second would tell a visitor who never signed in that
            // something of theirs was taken away.
            const hadSession = queryClient.getQueryData(currentUserKey) != null;

            // Answer the probe with "no user" rather than invalidating it: the
            // session is gone, so a refetch would only 401 again, and the null
            // settles the gate on `unauthenticated` at once. Deliberately not
            // `removeQueries`/`clear` — evicting queries that still have mounted
            // observers makes them refetch, and each refetch 401s straight back
            // into this handler. The redirect unmounts the private tree instead,
            // leaving its data inactive for the cache's own GC.
            queryClient.setQueryData(currentUserKey, null);

            if (!hadSession) return;
            // Two audiences, one fact. The toast is announced now, in the live
            // region the host mounts outside the router — so it survives the
            // view being replaced; the flag is what the sign-in page reads to
            // keep the explanation on screen once the toast has expired.
            markSessionEnded();
            toast.warning(intl.formatMessage(messages.sessionEnded));
        });
        return () => setUnauthorizedHandler(null);
    }, [queryClient, intl]);

    return (
        <AuthProviderContext value={toAuthState(currentUser)}>
            {children}
        </AuthProviderContext>
    );
}
