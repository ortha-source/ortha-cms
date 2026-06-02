import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { users } from './users';

/** Discriminates the two one-time token flows (§4.4). */
export const tokenType = pgEnum('token_type', ['invite', 'reset']);

/**
 * One-time tokens backing both invite and reset flows — a single table
 * with a `type` discriminator. Only the hash is stored, never the raw
 * token.
 */
export const tokens = pgTable(
    'tokens',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** Which flow this token serves. */
        type: tokenType('type').notNull(),
        /** References the user the token was issued to. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /**
         * Hash of the raw token (e.g. SHA-256). Unique — two live tokens
         * must not share a hash, and verification looks up by this column
         * (the constraint provides the backing index).
         */
        tokenHash: text('token_hash').notNull().unique(),
        /** Absolute expiry. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        /** Set when consumed; null while still valid. */
        consumedAt: timestamp('consumed_at', { withTimezone: true }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // "expire/revoke a user's tokens" lookups.
        index('tokens_user_id_idx').on(table.userId)
    ]
);
