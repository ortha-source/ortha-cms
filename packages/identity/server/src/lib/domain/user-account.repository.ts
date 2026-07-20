import type { UserAccount } from './user-account';
import type { UserId } from './value-objects/user-id';

/**
 * The persistence **port** for the {@link UserAccount} aggregate. The domain and
 * application layers depend on this interface; the infrastructure layer binds a
 * Drizzle-backed adapter to {@link USER_ACCOUNT_REPOSITORY} over identity's
 * `users` table.
 */
export interface UserAccountRepository {
    /**
     * Loads the aggregate for `id`, or `null` when no such account exists. Must
     * be called inside the active unit of work so it reads the same transaction
     * the subsequent {@link save} writes to.
     */
    findById(id: UserId): Promise<UserAccount | null>;

    /**
     * Persists a loaded aggregate's status/credential deltas. A no-op when the
     * aggregate has no pending changes.
     */
    save(account: UserAccount): Promise<void>;
}

/**
 * DI token the infrastructure adapter binds to a {@link UserAccountRepository}.
 * A plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const USER_ACCOUNT_REPOSITORY = Symbol('USER_ACCOUNT_REPOSITORY');
