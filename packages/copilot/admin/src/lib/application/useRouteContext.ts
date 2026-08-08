import { useLocation } from 'react-router-dom';
import { readRouteContext, type RouteContext } from './readRouteContext';

/**
 * Where the user is, read from the URL on every navigation.
 *
 * **Why the route and not a context provider.** `useCurrentWorkspace()` reads a
 * context that `CurrentWorkspaceProvider` supplies, and that provider wraps only
 * the workspace shell's *inset content* — the app sidebar, where the copilot
 * launcher lives, renders outside it. Calling it there doesn't return `null`, it
 * **throws**: "useCurrentWorkspace must be used inside a WorkspaceShell route",
 * which takes the whole admin down on every page. The same would be true of
 * anything the entry editor exposed through context. The sidebar is still inside
 * the router, so the URL is the one source of truth reachable from where the
 * panel actually mounts.
 *
 * The parsing itself is {@link readRouteContext}, kept pure and tested
 * separately.
 */
export function useRouteContext(): RouteContext {
    const { pathname, search } = useLocation();
    return readRouteContext(pathname, search);
}
