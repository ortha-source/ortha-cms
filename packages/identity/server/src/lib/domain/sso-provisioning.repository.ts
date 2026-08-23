/** A newly provisioned account. */
export interface ProvisionedAccount {
    /** The new account's id. */
    userId: string;
    /** The stored (lower-cased) email. */
    email: string;
}

/** What creating an account from a verified profile needs. */
export interface ProvisionAccountInput {
    /** The verified, lower-cased address. */
    email: string;
    /** The display name the provider reported, when it reported one. */
    name: string | null;
    /** The role the account lands on. */
    roleId: string;
}

/**
 * The writes just-in-time provisioning and role mapping need, which the
 * {@link UserAccount} aggregate deliberately does not offer.
 *
 * The aggregate models the **lifecycle of one account** — activate, disable,
 * change credential — and it is loaded by id, so it cannot be the thing that
 * brings an account into existence. Role assignment is left out of it for a
 * different reason: it is a cross-account rule (the users context owns
 * last-admin protection), and an aggregate that could quietly change its own
 * role would be a way around that.
 *
 * Kept narrow on purpose: three operations, all of them reached only from the
 * SSO sign-in path.
 */
export interface SsoProvisioningRepository {
    /**
     * The id of the role with this key, or `null` when the deployment has no
     * such role. A typo in configuration or in a role-mapping handler resolves
     * to `null` and is logged — never a failed sign-in, because a mistake in a
     * mapping should not lock a whole directory out of the CMS.
     */
    findRoleIdByKey(key: string): Promise<string | null>;

    /**
     * Creates an `active` account with **no password hash**.
     *
     * That absence is the point: the account has no credential of its own, so
     * it can be signed in only through the identity provider that created it,
     * and the password path refuses it exactly as it refuses an unaccepted
     * invite. Should the person ever need a password, the ordinary reset flow
     * is what gives them one.
     *
     * Joins the calling unit of work, so the account, its identity link and the
     * session it opened all commit together.
     */
    provision(input: ProvisionAccountInput): Promise<ProvisionedAccount>;

    /**
     * Points an account at a different role, returning `true` when the row
     * actually changed. `false` means the account already held it — which is
     * the common case on every sign-in after the first, and the reason the
     * caller can use this to decide whether an event is worth raising.
     */
    setRole(userId: string, roleId: string): Promise<boolean>;

    /**
     * The key of the role an account currently holds, or `null` when the
     * account is gone.
     *
     * Read before a role-mapping handler is allowed to move anyone, because
     * one case has to be refused outright: **an account already holding
     * `admin` is never demoted by a mapping.** Administrator is a deliberate
     * grant, a directory group is not, and the alternative is a group edit
     * nobody thought of as dangerous quietly locking every administrator out
     * of the CMS. Last-admin protection lives in the users context and does not
     * run on this path, so this is the guard that does.
     */
    roleKeyOf(userId: string): Promise<string | null>;
}

/**
 * DI token the infrastructure adapter binds to an
 * {@link SsoProvisioningRepository}.
 */
export const SSO_PROVISIONING_REPOSITORY = Symbol(
    'SSO_PROVISIONING_REPOSITORY'
);
