import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Access level a bearer token grants to the external content API.
 * `read` maps to `content:read`; `full` maps to the full content CRUD set.
 * The token carries the scope; the guard turns it into a permission set.
 */
export const apiTokenScope = pgEnum('api_token_scope', ['read', 'full']);

/**
 * Long-lived bearer tokens for the external content API (`/api/v1/...`).
 * Unlike the one-time {@link tokens} (invite/reset), these authenticate a
 * developer/service and are scoped to exactly one workspace.
 *
 * Only the SHA-256 hash of the raw token is stored, never the raw token —
 * the plaintext is shown to the creator exactly once, on mint. Verification
 * hashes the presented bearer and looks up by {@link apiTokens.tokenHash}
 * (the unique constraint provides the backing index).
 */
export const apiTokens = pgTable(
    'api_tokens',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * The single workspace this token can read. Plain uuid (no cross-plugin
         * FK) — tenancy is enforced in the app layer, matching the generated
         * `content_*` tables. The guard scopes every request to this id.
         */
        workspaceId: uuid('workspace_id').notNull(),
        /** Human label shown in the admin list (e.g. "CI deploy", "Preview app"). */
        name: text('name').notNull(),
        /**
         * SHA-256 hash of the raw token. Unique — verification looks up by this
         * column and two live tokens must not collide.
         */
        tokenHash: text('token_hash').notNull().unique(),
        /**
         * The non-secret leading characters of the raw token (e.g.
         * `orthacms_ab12cd`). Safe to display so an admin can recognise a token
         * in the list without ever seeing the secret again.
         */
        lookupPrefix: text('lookup_prefix').notNull(),
        /** Access level this token grants. */
        scope: apiTokenScope('scope').notNull(),
        /**
         * Absolute expiry. **Null means the token never expires** (unlimited
         * access) — unlike the one-time tokens' NOT NULL expiry.
         */
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        /** The user who minted the token. */
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Last time the token authenticated a request (throttled touch). */
        lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
        /** Set when revoked; null while the token is live. */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // "list / revoke a workspace's tokens" lookups.
        index('api_tokens_workspace_id_idx').on(table.workspaceId)
    ]
);
