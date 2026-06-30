import axios from 'axios';

/**
 * The shared admin HTTP client. Targets the API behind the host's global `/api`
 * prefix (same-origin via the admin dev proxy) and sends credentials so the
 * `httpOnly` session cookie rides along — including cross-origin later, where
 * `withCredentials` becomes necessary.
 *
 * Plugins call this (`apiClient.post('/auth/login', …)`) instead of importing
 * `axios` directly, so base URL, credentials, and interceptors (the workspace
 * header below; a future global `401` → redirect) live in exactly one place.
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
