/**
 * Permission that gates creating a workspace. Mirrors the server's RBAC matrix
 * (`@RequirePermissions('workspaces:create')`) and the list-page create button;
 * shared so the sidebar's create affordances can't drift from that string.
 */
export const WORKSPACES_CREATE = 'workspaces:create';
