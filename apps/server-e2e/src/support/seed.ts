import type { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { getDatabase, getPool } from '@ortha-cms/database';
import {
    RootAdminService,
    roles,
    sessions,
    tokens,
    users,
    type RootAdminOutcome
} from '@ortha-cms/identity-server';
import {
    memberships,
    workspaceContent,
    workspaces
} from '@ortha-cms/workspaces-server';
import { mediaAsset, mediaFolder } from '@ortha-cms/media-server';
// The e2e-owned generated content tables (from the harness's own content model,
// NOT the app's collections). Specs reach these only through the helpers below.
import {
    testArticleTags,
    testArticles,
    testAuthors,
    testLandingPage,
    testPages,
    testTags
} from './content';
// HashingService is internal to the identity plugin (not re-exported). We reach
// for the class to pull the SAME provider instance out of the DI container, so
// seeded password hashes are produced by the exact code login verifies against
// — no re-implemented bcrypt to drift.
import { HashingService } from '../../../../packages/identity/server/src/lib/auth/services/hashing.service';

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
        name?: string;
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
            name: opts.name ?? null,
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
    opts: {
        email: string;
        password: string;
        role: SystemRoleKey;
        name?: string;
    }
): Promise<SeededUser> {
    return seedUser(app, { ...opts, status: 'active' });
}

/**
 * Insert an active user under a freshly-created, **permission-less** role —
 * the principal that proves a route requires a specific permission rather than
 * mere authentication. `roleKey` must be unique across a run (`roles` is not
 * truncated by `resetDb`), so callers pass a suite-specific key and create it
 * once.
 */
export async function seedUserWithEmptyRole(
    app: INestApplication,
    opts: { email: string; password: string; roleKey: string }
): Promise<SeededUser> {
    const db = getDatabase();
    const [role] = await db
        .insert(roles)
        .values({ key: opts.roleKey, name: opts.roleKey, isSystem: false })
        .returning();
    const passwordHash = await app
        .get(HashingService)
        .hashPassword(opts.password);
    const [user] = await db
        .insert(users)
        .values({
            email: opts.email,
            passwordHash,
            roleId: role.id,
            status: 'active'
        })
        .returning();
    return { id: user.id, email: user.email };
}

/** A seeded workspace row — what the workspaces read assertions reference. */
export interface SeededWorkspace {
    id: string;
    name: string;
    slug: string;
    color: string;
}

/**
 * Insert a workspace row directly. `description` defaults to `null`; `color`
 * is omitted so the schema default (`slate`) applies unless overridden.
 */
export async function seedWorkspace(opts: {
    name: string;
    slug: string;
    description?: string;
    color?: string;
}): Promise<SeededWorkspace> {
    const [workspace] = await getDatabase()
        .insert(workspaces)
        .values({
            name: opts.name,
            slug: opts.slug,
            description: opts.description ?? null,
            ...(opts.color ? { color: opts.color } : {})
        })
        .returning();
    return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        color: workspace.color
    };
}

/**
 * Grant a workspace access to content slugs (the `workspace_content` rows the
 * create wizard writes). Membership alone is not access: the filter-fields
 * surface 404s a type the workspace was never granted, and prunes relations
 * into ungranted targets, so a spec that asserts on the surface has to seed
 * the grants its assertions assume.
 */
export async function seedContentGrants(
    workspaceId: string,
    slugs: readonly string[],
    kind: 'collection' | 'single' = 'collection'
): Promise<void> {
    if (slugs.length === 0) return;
    await getDatabase()
        .insert(workspaceContent)
        .values(slugs.map((slug) => ({ workspaceId, kind, slug })));
}

/** Add a user to a workspace (the `memberships` join). */
export async function seedMembership(
    userId: string,
    workspaceId: string
): Promise<void> {
    await getDatabase().insert(memberships).values({ userId, workspaceId });
}

/** The workspace ids a user belongs to — for asserting membership side effects. */
export async function getWorkspaceIdsForUser(
    userId: string
): Promise<string[]> {
    const rows = await getDatabase()
        .select({ workspaceId: memberships.workspaceId })
        .from(memberships)
        .where(eq(memberships.userId, userId));
    return rows.map((row) => row.workspaceId);
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

/** A user row joined to its role key — what root-admin assertions read. */
export interface UserRow {
    id: string;
    email: string;
    status: UserStatus;
    roleKey: string;
    passwordHash: string | null;
}

/** Look up a single user by (case-insensitive) email, with its role key. */
export async function getUserByEmail(email: string): Promise<UserRow | null> {
    const [row] = await getDatabase()
        .select({
            id: users.id,
            email: users.email,
            status: users.status,
            roleKey: roles.key,
            passwordHash: users.passwordHash
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.email, email.trim().toLowerCase()));
    return row ?? null;
}

/** Count user rows — used to assert the bootstrap inserts exactly one. */
export async function countUsers(): Promise<number> {
    const rows = await getDatabase().select({ id: users.id }).from(users);
    return rows.length;
}

/**
 * Drive the plugin's real `RootAdminService.ensure` (pulled from DI) against
 * the live test DB — it hashes through the app's `HashingService`, so the
 * stored hash is what login verifies. Lets specs assert the bootstrap's
 * idempotency and non-destructive behavior without re-importing internals.
 */
export async function provisionRootAdmin(
    app: INestApplication,
    opts: { email: string; password: string }
): Promise<RootAdminOutcome> {
    return app.get(RootAdminService).ensure(opts.email, opts.password);
}

/**
 * The live invite tokens for a user — `tokenHash`s only (the raw token is
 * never stored). Used to assert that inviting issues a token and that resend
 * rotates it (a different hash, still exactly one).
 */
export async function getInviteTokenHashes(userId: string): Promise<string[]> {
    const rows = await getDatabase()
        .select({ tokenHash: tokens.tokenHash, type: tokens.type })
        .from(tokens)
        .where(eq(tokens.userId, userId));
    return rows
        .filter((row) => row.type === 'invite')
        .map((row) => row.tokenHash);
}

/**
 * Force a user's invite tokens into the past — simulates a link that sat in an
 * inbox past its TTL, without making the suite wait out the real one.
 */
export async function expireInviteTokens(userId: string): Promise<void> {
    await getDatabase()
        .update(tokens)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(and(eq(tokens.userId, userId), eq(tokens.type, 'invite')));
}

/**
 * Whether a user's invite token has been burned — `consumedAt` is what makes an
 * invite link one-time, so a spec asserting "the link is spent" reads it here.
 * `null` when the user has no invite token at all.
 */
export async function getInviteConsumedAt(
    userId: string
): Promise<Date | null | undefined> {
    const [row] = await getDatabase()
        .select({ consumedAt: tokens.consumedAt })
        .from(tokens)
        .where(and(eq(tokens.userId, userId), eq(tokens.type, 'invite')));
    return row?.consumedAt;
}

/** Count a user's session rows — used to assert a session was created. */
export async function countUserSessions(userId: string): Promise<number> {
    const rows = await getDatabase()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));
    return rows.length;
}

/** Read every audit event, newest first — what the activity assertions read. */
export async function getActivityRows(): Promise<
    {
        kind: string;
        subjectType: string;
        subjectId: string;
        actorId: string | null;
        actorEmail: string | null;
        meta: unknown;
    }[]
> {
    const { rows } = await getPool().query(
        `SELECT kind, subject_type AS "subjectType", subject_id AS "subjectId",
                actor_id AS "actorId", actor_email AS "actorEmail", meta
         FROM activity_events
         ORDER BY at DESC, id DESC`
    );
    return rows;
}

/** Count audit events — used to assert a rolled-back mutation writes none. */
export async function countActivityRows(): Promise<number> {
    const { rows } = await getPool().query(
        'SELECT count(*)::int AS total FROM activity_events'
    );
    return rows[0].total;
}

/**
 * Truncate the mutable tables between tests, leaving the seeded system roles
 * and permissions in place (users reference roles via FK). `CASCADE` clears
 * dependent rows — sessions, tokens, memberships — in one statement.
 * `activity_events` is truncated explicitly: its `actor_id` has no FK, so a
 * `users` cascade never reaches it. Every e2e content table is truncated too
 * (content has no FK to `workspaces`, so a workspace cascade never reaches it);
 * `CASCADE` on `content_test_article` also clears its join + comment children.
 * `content_entry_revisions` is truncated explicitly for the same reason as
 * `activity_events`: it keys entries by plain uuid with no FK, so no cascade
 * reaches it and every save's snapshot would otherwise outlive its test.
 */
export async function resetDb(): Promise<void> {
    await getPool().query(
        'TRUNCATE TABLE users, workspaces, activity_events, ' +
            'content_test_article, content_test_author, content_test_tag, ' +
            'content_test_seo, content_test_comment, content_test_landing, ' +
            'content_test_page, content_entry_revisions, ' +
            'media_asset, media_folder ' +
            'RESTART IDENTITY CASCADE'
    );
}

/** A seeded media folder row. */
export interface SeededMediaFolder {
    id: string;
}

/**
 * Insert a `media_folder` row directly. `parentId` defaults to `null` (a
 * top-level folder). Scoped to `workspaceId`.
 */
export async function seedMediaFolder(opts: {
    workspaceId: string;
    name: string;
    parentId?: string | null;
}): Promise<SeededMediaFolder> {
    const [row] = await getDatabase()
        .insert(mediaFolder)
        .values({
            workspaceId: opts.workspaceId,
            name: opts.name,
            parentId: opts.parentId ?? null
        })
        .returning();
    return { id: row.id };
}

/**
 * Insert a `media_asset` row directly (for list/scoping/permission tests where
 * the bytes are never read). Its `storage_key` points at the `memory` provider
 * but no blob is written — use an API upload when the download path is exercised.
 * `folderId` defaults to `null` (the workspace root).
 */
export async function seedMediaAsset(opts: {
    workspaceId: string;
    uploadedBy: string;
    name: string;
    folderId?: string | null;
    kind?: 'image' | 'video' | 'audio' | 'document' | 'archive';
    mimeType?: string;
    size?: number;
}): Promise<{ id: string }> {
    const [row] = await getDatabase()
        .insert(mediaAsset)
        .values({
            workspaceId: opts.workspaceId,
            folderId: opts.folderId ?? null,
            name: opts.name,
            kind: opts.kind ?? 'document',
            mimeType: opts.mimeType ?? 'application/pdf',
            size: opts.size ?? 1024,
            storageKey: `${opts.workspaceId}/seed/${opts.name}`,
            storageProvider: 'memory',
            uploadedBy: opts.uploadedBy
        })
        .returning();
    return { id: row.id };
}

/** Count `media_asset` rows in a workspace — asserts upload/delete side effects. */
export async function countMediaAssets(workspaceId: string): Promise<number> {
    const rows = await getDatabase()
        .select({ id: mediaAsset.id })
        .from(mediaAsset)
        .where(eq(mediaAsset.workspaceId, workspaceId));
    return rows.length;
}

/**
 * Insert rows into the `test_article` collection (publishable + paranoid). Each
 * row needs at least `text` + `select` (the type's required fields); `status`
 * defaults to `draft`. Returns the inserted ids in input order (for wiring up
 * relations); assertions still go through the HTTP API.
 *
 * Entries are workspace-scoped: pass `workspaceId` to stamp the owning
 * workspace's `workspace_id` on every row (the value the `WorkspaceGuard`
 * filters by). A per-row `workspaceId` still takes precedence. Omit it only for
 * the "orphan row is invisible" path — rows with a null `workspace_id` are
 * visible to no request.
 */
export async function seedArticles(
    rows: Record<string, unknown>[],
    workspaceId?: string
): Promise<string[]> {
    if (rows.length === 0) return [];
    // The generated table's column set is dynamic, so the insert values aren't
    // statically typed — the column names match the field names by construction.
    // `workspaceId` (the default) merges first so a per-row override wins.
    // `locale` is NOT NULL (the i18n columns have no default), so default it to
    // the config's default locale (`en`); a per-row value wins.
    // The generated table's columns aren't statically typed (see the `as never`
    // on the values above), so project the returned rows rather than naming the
    // `id` column in `.returning()`.
    const inserted = (await getDatabase()
        .insert(testArticles)
        .values(
            rows.map((row) => ({ workspaceId, locale: 'en', ...row })) as never
        )
        .returning()) as { id: string }[];
    return inserted.map((row) => row.id);
}

/**
 * Insert rows into the `test_author` collection and return the inserted ids in
 * input order, so a caller can wire them into an article's `author` FK (the
 * many-to-one side of the relation).
 */
export async function seedAuthors(
    rows: Record<string, unknown>[],
    workspaceId?: string
): Promise<string[]> {
    if (rows.length === 0) return [];
    // `test_author` is i18n, so `locale` is NOT NULL with no default (see
    // {@link seedArticles}); a per-row value still wins.
    const inserted = (await getDatabase()
        .insert(testAuthors)
        .values(
            rows.map((row) => ({ workspaceId, locale: 'en', ...row })) as never
        )
        .returning()) as { id: string }[];
    return inserted.map((row) => row.id);
}

/**
 * Insert rows into the `test_tag` collection and return the inserted ids in
 * input order — the far side of the `test_article.tags` many-to-many. Unlike
 * {@link seedArticles} / {@link seedAuthors}, `test_tag` is **not** i18n, so it
 * has no `locale` column to default.
 */
export async function seedTags(
    rows: Record<string, unknown>[],
    workspaceId?: string
): Promise<string[]> {
    if (rows.length === 0) return [];
    const inserted = (await getDatabase()
        .insert(testTags)
        .values(rows.map((row) => ({ workspaceId, ...row })) as never)
        .returning()) as { id: string }[];
    return inserted.map((row) => row.id);
}

/**
 * Insert rows into the `test_page` collection (the self-referential tree) and
 * return the inserted ids in input order. Rows are inserted **one at a time**,
 * in order, so a later row can name an earlier one as its `parent` — a batch
 * insert couldn't reference an id it hasn't returned yet. Not i18n, not
 * publishable, so `title` is the only required value.
 */
export async function seedPages(
    rows: Record<string, unknown>[],
    workspaceId?: string
): Promise<string[]> {
    const ids: string[] = [];
    for (const row of rows) {
        const [inserted] = (await getDatabase()
            .insert(testPages)
            .values({ workspaceId, ...row } as never)
            .returning()) as { id: string }[];
        ids.push(inserted.id);
    }
    return ids;
}

/**
 * Soft-delete `test_author` rows (stamp `deleted_at`), so a spec can assert a
 * relation filter no longer traverses them — the workspace + soft-delete
 * `scope` the engine ANDs inside a relation's EXISTS subquery. Writes the
 * tombstone directly rather than through the API, mirroring the other seeders.
 */
export async function softDeleteAuthors(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Raw parameterized UPDATE (like {@link resetDb}) — the generated table's
    // columns aren't statically typed, so `getPool` is cleaner than reaching
    // for an untyped `.id` column off the Drizzle table.
    await getPool().query(
        'UPDATE content_test_author SET deleted_at = now() WHERE id = ANY($1::uuid[])',
        [ids]
    );
}

/**
 * Link an article to tags in the generated join table, ordered by array index
 * (`position`) — the same ordering the relation read pages by. Writes the join
 * rows directly rather than going through the API, so a spec can stand up a
 * relation with many links cheaply.
 */
export async function seedArticleTags(
    articleId: string,
    tagIds: string[]
): Promise<void> {
    if (tagIds.length === 0) return;
    await getDatabase()
        .insert(testArticleTags)
        .values(
            tagIds.map((tagId, index) => ({
                sourceId: articleId,
                targetId: tagId,
                position: index
            })) as never
        );
}

/**
 * Insert rows into the `test_landing` page (non-publishable: no `status`
 * column). Pass `workspaceId` to stamp the owning workspace on every row (a
 * per-row `workspaceId` still wins); see {@link seedArticles}.
 */
export async function seedLanding(
    rows: Record<string, unknown>[],
    workspaceId?: string
): Promise<void> {
    if (rows.length === 0) return;
    // `locale` is NOT NULL (see {@link seedArticles}); default it to `en`.
    await getDatabase()
        .insert(testLandingPage)
        .values(
            rows.map((row) => ({ workspaceId, locale: 'en', ...row })) as never
        );
}
