import { Injectable } from '@nestjs/common';
import { UserAccount } from '../../domain/user-account';

/** A `users` row as selected for aggregate reconstruction. */
export interface UserAccountRow {
    id: string;
    email: string;
    status: string;
    passwordHash: string | null;
}

/**
 * Translates a persisted `users` row into the {@link UserAccount} aggregate.
 * Keeps the row shape out of the domain and the aggregate out of the
 * repository's query code. The reverse direction (aggregate → patch) lives in
 * the repository.
 */
@Injectable()
export class UserAccountMapper {
    /** Rebuilds the aggregate from a `users` row. */
    toDomain(row: UserAccountRow): UserAccount {
        return UserAccount.rehydrate({
            id: row.id,
            email: row.email,
            status: row.status,
            passwordHash: row.passwordHash
        });
    }
}
