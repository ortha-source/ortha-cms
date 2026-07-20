import { inArray } from 'drizzle-orm';
import { type Database } from '@ortha-cms/database';
import { users } from '@ortha-cms/identity-server';

/** Fallback shown when an uploader can't be resolved (deleted account, etc.). */
export const UNKNOWN_UPLOADER = 'Unknown';

/**
 * Resolves uploader user ids to display names in one batched query. Media rows
 * store only the uploader's id; the admin shows a name. A missing user maps to
 * {@link UNKNOWN_UPLOADER}.
 */
export async function resolveUploaderNames(
    db: Database,
    ids: string[]
): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) {
        return new Map();
    }
    const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, row.name ?? UNKNOWN_UPLOADER]));
}
