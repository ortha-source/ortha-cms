/**
 * The seam between the public "forgot your password?" route, which identity
 * owns, and the work behind it, which it does not.
 *
 * Identity owns the signed-out surface: the route, its rate limits and the
 * rule that nothing about the response varies with the address. Issuing a
 * reset link is the users context's job — it owns who may be reset, rotates the
 * token (`PasswordResetTokenService`) and hands the message to the mailer in
 * the same transaction — and the users plugin is deliberately **not global and
 * exports nothing**, so it cannot bind a DI token identity resolves. It
 * registers itself with {@link PasswordRecoveryRegistry} from `onModuleInit`
 * instead, the same shape the workspaces plugin's purge registry uses.
 */
export interface PasswordRecoveryIssuer {
    /**
     * Whether this deployment can send a recovery message at all — `false`
     * without a mail provider, in which case the route answers `404`
     * (ADR-0018: "absent without a provider, not erroring").
     */
    readonly available: boolean;

    /**
     * Sends a reset link to `email` if, and only if, an active account uses it
     * and it is allowed one now. Resolves the same way in every case; the
     * caller never learns which one happened.
     */
    issue(email: string): Promise<void>;
}
