import { Injectable } from '@nestjs/common';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { users } from '../../schema';

/** A directory user as returned by the search endpoint. */
export interface DirectoryUser {
    /** Stable user id. */
    id: string;
    /** Display name; falls back to the email when the user has none yet. */
    name: string;
    /** Email address. */
    email: string;
}

/** How many matches the directory search returns at most. */
const SEARCH_LIMIT = 10;

/**
 * Reads the user directory. Backs the workspace wizard's member typeahead;
 * transport-agnostic (returns plain rows, the controller maps to HTTP).
 */
@Injectable()
export class UserService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Active users whose name or email matches `query` (case-insensitive
     * substring). A blank query lists the first {@link SEARCH_LIMIT} users.
     * Pending/disabled accounts are excluded — only people who can sign in show
     * up as assignable members.
     */
    async search(query: string): Promise<DirectoryUser[]> {
        const q = query.trim();
        const active = eq(users.status, 'active');
        const where = q
            ? and(
                  active,
                  or(
                      ilike(users.name, `%${q}%`),
                      ilike(users.email, `%${q}%`)
                  )
              )
            : active;

        const rows = await this.db
            .select({
                id: users.id,
                name: users.name,
                email: users.email
            })
            .from(users)
            .where(where)
            .orderBy(sql`lower(${users.email})`)
            .limit(SEARCH_LIMIT);

        return rows.map((row) => ({
            id: row.id,
            name: row.name ?? row.email,
            email: row.email
        }));
    }
}
