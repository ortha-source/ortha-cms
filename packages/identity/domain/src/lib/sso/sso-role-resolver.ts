import type { SsoProfile } from './sso-profile';

/** What the core knows when it asks which role a person should hold. */
export interface SsoRoleContext {
    /** The registered provider name the person signed in through. */
    provider: string;
    /** The verified profile, including any group claims that were requested. */
    profile: SsoProfile;
    /**
     * Whether this sign-in is creating the account, rather than signing in one
     * that already exists.
     *
     * A handler will usually want to answer differently: setting the role of a
     * brand-new account is the only way it gets one, while overwriting the role
     * of an existing account undoes whatever an administrator last chose.
     */
    isNewAccount: boolean;
}

/**
 * The optional custom handler that decides which role an SSO sign-in lands on
 * — full custom code, returning a **role key** (`admin`, `contributor`,
 * `viewer`, or one this deployment created).
 *
 * Returning `null` means "leave the role alone", and that is what the absence
 * of a handler means too. That default is deliberate: a mapping that ran on
 * every sign-in would silently undo an administrator's edit the next time the
 * person signed in, and nothing in the product would show why the change did
 * not stick.
 *
 * A key this deployment does not have is treated as `null` and logged, rather
 * than failing the sign-in: a typo in a handler should not lock a directory out
 * of the CMS.
 */
export type SsoRoleResolver = (context: SsoRoleContext) => string | null;

/** DI token the composition root binds to the {@link SsoRoleResolver}. */
export const SSO_ROLE_RESOLVER = Symbol('SSO_ROLE_RESOLVER');
