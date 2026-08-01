/**
 * A live invite — an unconsumed, unexpired `invite` token row joined to the
 * `pending` account it was issued to. The email and name were frozen by the
 * inviting admin; the invitee only supplies a password, so these are what the
 * accept screen shows back rather than collects.
 */
export interface PendingInvite {
    /** The `tokens` row id — what {@link InviteRepository.consume} stamps. */
    tokenId: string;
    /** The invited account's id. */
    userId: string;
    /** The email the invite was addressed to. */
    email: string;
    /** The display name the inviting admin set, or `null` when they set none. */
    name: string | null;
}

/**
 * The persistence **port** for the invite half of identity's one-time `tokens`
 * table. Two operations, both on the accept path: resolve a presented token to
 * the invite it stands for, and burn it.
 *
 * The raw token never reaches this port — callers hash it first
 * ({@link HashingService.hashToken}), matching how sessions and API tokens are
 * looked up. Issuing invites is the users context's job (it owns who gets
 * invited); identity owns the table and the redemption.
 */
export interface InviteRepository {
    /**
     * Resolves `tokenHash` to its {@link PendingInvite}, or `null` when no such
     * token exists, it has expired, or it was already consumed. All three cases
     * collapse to `null` on purpose — the caller must not be able to tell them
     * apart.
     */
    findPendingByTokenHash(tokenHash: string): Promise<PendingInvite | null>;

    /**
     * Burns the token, returning whether **this** call was the one that burned
     * it. Must be a single conditional write (stamp `consumedAt` only while it
     * is still null), so two concurrent accepts of the same link cannot both
     * succeed — a read-then-write here would let both through.
     */
    consume(tokenId: string): Promise<boolean>;
}

/**
 * DI token the infrastructure adapter binds to an {@link InviteRepository}.
 * A plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const INVITE_REPOSITORY = Symbol('INVITE_REPOSITORY');
