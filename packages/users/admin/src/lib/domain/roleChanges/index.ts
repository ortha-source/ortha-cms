/**
 * The capabilities the role dialog compares, each defined by the permission
 * keys it takes — so the "What changes" table is computed from the grants the
 * server reports (`GET /api/users/roles`), never from a second copy of the
 * matrix kept here. A capability is held when **every** key it lists is
 * granted.
 *
 * The rows are the ones a person deciding on a role asks about, in the
 * board's order. "Create and configure workspaces" stands where the mockup
 * said "Every workspace, including new ones": workspace access is by
 * membership for every role, admins included, so the mockup's row would have
 * promised a grant the server does not make.
 */
export const ROLE_CAPABILITIES = [
    {
        id: 'editContent',
        permissions: ['content:update', 'content:publish']
    },
    {
        id: 'manageMembers',
        permissions: ['users:update']
    },
    {
        id: 'tokensAndWebhooks',
        permissions: ['tokens:create', 'webhooks:manage']
    },
    {
        id: 'manageWorkspaces',
        permissions: ['workspaces:create', 'workspaces:update']
    }
] as const;

/** One capability's stable id. */
export type RoleCapabilityId = (typeof ROLE_CAPABILITIES)[number]['id'];

/** One row of the "What changes" table. */
export type RoleCapabilityChange = {
    /** Which capability. */
    id: RoleCapabilityId;
    /** Whether the current role holds it. */
    before: boolean;
    /** Whether the proposed role holds it. */
    after: boolean;
    /** Whether the change flips it — the rows the dialog highlights. */
    changed: boolean;
};

/** Whether a set of grants holds every key a capability needs. */
function holds(
    granted: ReadonlySet<string>,
    needed: readonly string[]
): boolean {
    return needed.every((key) => granted.has(key));
}

/**
 * Compares two roles' grants capability by capability. Pure; the caller passes
 * the two permission lists from the role catalogue.
 */
export function roleChanges(
    current: readonly string[],
    proposed: readonly string[]
): RoleCapabilityChange[] {
    const before = new Set(current);
    const after = new Set(proposed);
    return ROLE_CAPABILITIES.map((capability) => {
        const had = holds(before, capability.permissions);
        const has = holds(after, capability.permissions);
        return {
            id: capability.id,
            before: had,
            after: has,
            changed: had !== has
        };
    });
}
