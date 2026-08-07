import axios from 'axios';
import { HTTP_STATUS } from '../httpStatus';

/**
 * The shared admin HTTP client. Targets the API behind the host's global `/api`
 * prefix (same-origin via the admin dev proxy) and sends credentials so the
 * `httpOnly` session cookie rides along — including cross-origin later, where
 * `withCredentials` becomes necessary.
 *
 * Plugins call this (`apiClient.post('/auth/login', …)`) instead of importing
 * `axios` directly, so base URL, credentials, and interceptors (the workspace
 * header and the global `401` handling below) live in exactly one place.
 */
export const apiClient = axios.create({
    baseURL: '/api',
    withCredentials: true
});

/**
 * The workspace the admin is currently scoped to, or `null` outside a workspace
 * (e.g. login, the workspaces grid). A module-level cell rather than React state
 * because the interceptor below runs outside the component tree — the workspace
 * shell keeps it in sync via {@link setActiveWorkspaceId}.
 */
let activeWorkspaceId: string | null = null;

/**
 * Sets (or clears, with `null`) the workspace every subsequent request is scoped
 * to. The workspace shell calls this as it resolves the open workspace, so the
 * server can isolate workspace-owned data (content entries) to the caller's
 * current workspace.
 */
export function setActiveWorkspaceId(id: string | null): void {
    activeWorkspaceId = id;
}

/**
 * Attach the active workspace as `X-Workspace-Id` on every request. The server's
 * `WorkspaceGuard` reads it on workspace-scoped routes (content) and ignores it
 * elsewhere; when no workspace is open the header is omitted entirely.
 */
apiClient.interceptors.request.use((config) => {
    if (activeWorkspaceId) {
        config.headers.set('X-Workspace-Id', activeWorkspaceId);
    }
    return config;
});

/**
 * Paths where a `401` is the endpoint's own answer rather than "the session
 * died": sign-in rejects bad credentials, the auth probe reports "not signed
 * in", logout on an already-dead session, and the invite endpoints are public.
 * Each caller handles its own `401`, so the global handler stays out of the way.
 */
const SELF_HANDLED_401_PATHS = [
    '/auth/login',
    '/auth/logout',
    '/auth/me',
    '/auth/invite'
];

/** The registered session-lost handler, or `null` while none is installed. */
let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers (or clears, with `null`) the callback fired when the server answers
 * a `401` to a request that expected an authenticated session — the session was
 * revoked, expired, or its account was suspended out from under the open tab.
 *
 * The handler lives here, in the transport, but the **auth state it flips** does
 * not: `@ortha-cms/identity-admin` owns that and installs a handler that drops
 * the cached current user, which settles the route gate on "unauthenticated" and
 * redirects to sign-in. Keeping only the seam here is what stops this leaf
 * package from depending on the identity plugin.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
}

/**
 * Fire the registered handler on an unexpected `401`, then rethrow — the global
 * sign-out is a side effect, never a substitute for the caller's own error
 * handling (a mutation still sees its rejection and can show its toast).
 */
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status: unknown = error?.response?.status;
        const url: string = error?.config?.url ?? '';
        if (
            status === HTTP_STATUS.UNAUTHORIZED &&
            !SELF_HANDLED_401_PATHS.some((path) => url.startsWith(path))
        ) {
            unauthorizedHandler?.();
        }
        return Promise.reject(error);
    }
);
