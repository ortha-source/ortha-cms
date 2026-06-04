import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { getDatabase, getPool } from '@ortha-cms/database';
import { roles, sessions, users } from '@ortha-cms/identity-server';
// HashingService is internal to the identity plugin (not re-exported). We reach
// for the class to pull the SAME provider instance out of the DI container, so
// seeded password hashes are produced by the exact code login verifies against
// — no re-implemented bcrypt to drift.
import { HashingService } from '../../../../packages/identity/server/src/lib/auth/hashing.service';

/** A system role key seeded by `SystemRolesSeeder` at app boot. */
export type SystemRoleKey = 'admin' | 'contributor' | 'viewer';

/** Account lifecycle status; only `active` may log in. */
export type UserStatus = 'pending' | 'active' | 'disabled';

export interface SeededUser {
    id: string;
    email: string;
}

/** Look up a seeded role id by its key (e.g. 'admin'). */
async function roleIdByKey(key: SystemRoleKey): Promise<string> {
    const db = getDatabase();
    const [role] = await db.select().from(roles).where(eq(roles.key, key));
    if (!role) {
        throw new Error(
            `Role "${key}" not found — are the system roles seeded?`
        );
    }
    return role.id;
}

/**
 * Insert a user with full control over status and password. When `password`
 * is omitted the row is stored with a `null` hash (the invite-pending state),
 * exercising the "no credential set" login path. Hashing goes through the
 * app's real `HashingService`.
 */
export async function seedUser(
    app: INestApplication,
    opts: {
        email: string;
        password?: string;
        role: SystemRoleKey;
        status?: UserStatus;
    }
): Promise<SeededUser> {
    const passwordHash = opts.password
        ? await app.get(HashingService).hashPassword(opts.password)
        : null;
    const roleId = await roleIdByKey(opts.role);

    const [user] = await getDatabase()
        .insert(users)
        .values({
            email: opts.email,
            passwordHash,
            roleId,
            status: opts.status ?? 'active'
        })
        .returning();

    return { id: user.id, email: user.email };
}

/** Convenience: an active user with valid credentials for `POST /auth/login`. */
export async function seedActiveUser(
    app: INestApplication,
    opts: { email: string; password: string; role: SystemRoleKey }
): Promise<SeededUser> {
    return seedUser(app, { ...opts, status: 'active' });
}

/** Force every session of a user into the past — simulates natural expiry. */
export async function expireUserSessions(userId: string): Promise<void> {
    await getDatabase()
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(sessions.userId, userId));
}

/** Revoke every session of a user — simulates an explicit logout/kill. */
export async function revokeUserSessions(userId: string): Promise<void> {
    await getDatabase()
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, userId));
}

/** Delete a user row (cascades to their sessions via FK). */
export async function deleteUser(userId: string): Promise<void> {
    await getDatabase().delete(users).where(eq(users.id, userId));
}

/** Count a user's session rows — used to assert a session was created. */
export async function countUserSessions(userId: string): Promise<number> {
    const rows = await getDatabase()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));
    return rows.length;
}

/**
 * Truncate the mutable tables between tests, leaving the seeded system roles
 * and permissions in place (users reference roles via FK). `CASCADE` clears
 * dependent rows — sessions, tokens, memberships — in one statement.
 */
export async function resetDb(): Promise<void> {
    await getPool().query(
        'TRUNCATE TABLE users, workspaces RESTART IDENTITY CASCADE'
    );
}
