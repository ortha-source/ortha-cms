import { eq } from 'drizzle-orm';
import type { Database } from '@ortha-cms/database';
import { roles, users } from '../schema';

/** The `admin` role key, seeded by `SystemRolesSeeder` (matches SYSTEM_ROLES). */
const ADMIN_ROLE_KEY = 'admin';

/** What a root-admin row needs at provisioning time. */
export interface RootAdminInput {
    /** Login email; trimmed and lower-cased here before storage. */
    email: string;
    /** A bcrypt hash — never plaintext. */
    passwordHash: string;
}

/** Whether the root admin was newly inserted or already present. */
export type RootAdminOutcome = 'created' | 'exists';

/**
 * Idempotently ensures one `active` administrator exists. Keyed on the
 * case-insensitive email unique index: a second run, or an email that is
 * already taken, is a no-op — it never overwrites an existing account's
 * password, role, or status (non-destructive by design).
 *
 * Requires the `admin` system role to be seeded first (an earlier boot hook);
 * throws clearly if it is absent rather than inserting a dangling FK.
 */
export async function ensureRootAdmin(
    db: Database,
    input: RootAdminInput
): Promise<RootAdminOutcome> {
    const email = input.email.trim().toLowerCase();

    return db.transaction(async (tx) => {
        const [adminRole] = await tx
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.key, ADMIN_ROLE_KEY))
            .limit(1);

        if (!adminRole) {
            throw new Error(
                'Cannot ensure root admin: the "admin" system role is ' +
                    'missing. System roles must be seeded first.'
            );
        }

        const inserted = await tx
            .insert(users)
            .values({
                email,
                passwordHash: input.passwordHash,
                roleId: adminRole.id,
                status: 'active'
            })
            // `users` has a single unique constraint (the lower(email) index),
            // so a bare DO NOTHING is the right guard — an existing email is
            // left exactly as it was.
            .onConflictDoNothing()
            .returning({ id: users.id });

        return inserted.length > 0 ? 'created' : 'exists';
    });
}
