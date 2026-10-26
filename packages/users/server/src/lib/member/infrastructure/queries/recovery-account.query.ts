import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { users } from '@orthacms/identity-server';

/**
 * Resolves the address typed into the public recovery form to the account that
 * uses it — the one read the self-service flow needs before it can ask the
 * {@link Member} aggregate whether a reset is allowed.
 *
 * A query of its own rather than a new method on the member repository: it is
 * the only caller that starts from an address, and it answers for nobody but
 * the use case that decides, out of the caller's sight, what to do with it.
 */
@Injectable()
export class RecoveryAccountQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * The id of the account whose email is `email` (compared
     * case-insensitively, as everywhere else), or `null`.
     */
    async idForEmail(email: string): Promise<string | null> {
        const [row] = await this.db
            .select({ id: users.id })
            .from(users)
            .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()))
            .limit(1);
        return row?.id ?? null;
    }
}
