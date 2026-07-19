/** A member to resolve, as carried by the create request. */
export interface MemberInput {
    /** Directory user id, or the typed email for an invited member. */
    id: string;
    /** Contact email (the lookup key for invited members). */
    email: string;
    /** Whether this is an invite-by-email rather than an existing account. */
    invited: boolean;
}

/**
 * Port that resolves the create wizard's members to real directory user ids.
 * Invited members (no account yet) are **provisioned** as pending users; a
 * non-invited id that resolves to no real user is dropped, so a stale directory
 * id can't abort the whole create on a foreign-key violation. Implemented in
 * infrastructure over identity's `users` table and bound to
 * {@link MEMBER_PROVISIONER}.
 */
export interface MemberProvisioner {
    /**
     * Resolves `members` to the set of valid user ids to link (excluding the
     * creator, whom the aggregate adds). Must run inside the active unit of work
     * so any provisioned users commit with the workspace.
     */
    resolve(members: MemberInput[]): Promise<string[]>;
}

/** DI token the infrastructure adapter binds to a {@link MemberProvisioner}. */
export const MEMBER_PROVISIONER = Symbol('MEMBER_PROVISIONER');
