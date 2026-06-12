import { useAuth } from '../authContext';

/**
 * Whether the signed-in user's role grants the given permission key (e.g.
 * `users:read`). `false` while auth is resolving or signed out — fail-closed,
 * so permissioned UI stays hidden until a grant is confirmed.
 *
 * UI gating only: hide or disable controls with it, but the server re-checks
 * every permissioned route regardless.
 */
export function useHasPermission(permission: string): boolean {
    const { user } = useAuth();
    // `permissions` is optional-chained defensively: a pre-permissions payload
    // (or a partial test mock) lacks it, and a fail-closed `false` beats a
    // crash.
    return user?.permissions?.includes(permission) ?? false;
}
