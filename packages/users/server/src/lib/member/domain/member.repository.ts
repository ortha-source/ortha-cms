import type { Member } from './member';
import type { MemberId } from './value-objects/member-id';

/**
 * The persistence **port** for the {@link Member} aggregate. The domain and
 * application layers depend on this interface; the infrastructure layer binds a
 * Drizzle-backed adapter to {@link MEMBER_REPOSITORY} over identity's
 * `users`/`roles` tables (which the users context reads but does not own).
 */
export interface MemberRepository {
    /**
     * Loads the aggregate for `id`, or `null` when no such member exists. Must
     * be called inside the active unit of work so it reads the same transaction
     * the subsequent {@link save} writes to.
     */
    findById(id: MemberId): Promise<Member | null>;

    /**
     * Loads the aggregate like {@link findById}, but first serializes against
     * concurrent admin-count mutations — the loading strategy for the last-admin
     * invariant (demote / disable). How that serialization happens (a
     * transaction-scoped advisory lock) is an infrastructure detail; the port
     * only promises the ordering guarantee, so a concurrent demote/disable can't
     * race the active-admin count below one.
     */
    findByIdForAdminGuard(id: MemberId): Promise<Member | null>;

    /**
     * Counts members who currently hold admin powers (active + admin role).
     * Call inside the unit of work **after** {@link findByIdForAdminGuard} so the
     * count is read under the same lock the last-admin guard relies on.
     */
    countActiveAdmins(): Promise<number>;

    /**
     * Whether an account already uses `email` (compared case-insensitively).
     * The friendly up-front check for invites; the DB's unique index is the
     * race-proof backstop (a violation surfaces as {@link EmailTakenError} from
     * {@link save}).
     */
    existsByEmail(email: string): Promise<boolean>;

    /**
     * Persists a member: inserts a brand-new aggregate (resolving its role key
     * to an id), or applies a loaded aggregate's name/role/status deltas. A
     * duplicate-email insert throws {@link EmailTakenError}.
     */
    save(member: Member): Promise<void>;

    /** Deletes the member's placeholder row (its token/memberships cascade). */
    delete(member: Member): Promise<void>;
}

/**
 * DI token the infrastructure adapter binds to a {@link MemberRepository}.
 * A plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');
