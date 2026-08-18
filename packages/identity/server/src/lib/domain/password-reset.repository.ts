/**
 * A live password reset — an unconsumed, unexpired `reset` token row joined to
 * the account it was issued to. The email and name are what the reset screen
 * shows back, so the person following the link can see *whose* password they
 * are about to set before they type one.
 */
export interface PendingPasswordReset {
    /** The `tokens` row id — what {@link PasswordResetRepository.consume} stamps. */
    tokenId: string;
    /** The account's id. */
    userId: string;
    /** The account's email. */
    email: string;
    /** The account's display name, or `null` when it has none. */
    name: string | null;
}

/**
 * The persistence **port** for the reset half of identity's one-time `tokens`
 * table. The same two operations the invite half has — resolve a presented
 * token to the reset it stands for, and burn it — kept as a separate port
 * because the two flows collapse to different errors and the reset path must
 * never resolve an `invite` row (or the other way round).
 *
 * The raw token never reaches this port — callers hash it first
 * ({@link HashingService.hashToken}), matching how sessions, invites, and API
 * tokens are looked up. Issuing resets is the users context's job (it owns who
 * an admin may reset); identity owns the table and the redemption.
 */
export interface PasswordResetRepository {
    /**
     * Resolves `tokenHash` to its {@link PendingPasswordReset}, or `null` when
     * no such token exists, it has expired, or it was already consumed. All
     * three collapse to `null` on purpose — the caller must not be able to tell
     * them apart.
     */
    findPendingByTokenHash(
        tokenHash: string
    ): Promise<PendingPasswordReset | null>;

    /**
     * Burns the token, returning whether **this** call was the one that burned
     * it. Must be a single conditional write (stamp `consumedAt` only while it
     * is still null), so two concurrent submissions of the same link cannot both
     * set a password — a read-then-write here would let both through, and the
     * loser's password would silently win or lose depending on commit order.
     */
    consume(tokenId: string): Promise<boolean>;
}

/**
 * DI token the infrastructure adapter binds to a
 * {@link PasswordResetRepository}. A plain `Symbol`, so the domain declares it
 * without importing `@nestjs/*`.
 */
export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY');
