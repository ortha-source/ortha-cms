import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Server-side, revocable session (FR-4). `id` IS the opaque random secret
 * handed to the client — application-generated, never derived or
 * predictable.
 */
export const sessions = pgTable(
    'sessions',
    {
        /** Opaque random token. Not a uuid default — supplied by the app. */
        id: text('id').primaryKey(),
        /** References the session owner. */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Absolute expiry. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        /** Set when revoked; null while active. */
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Updated on each authenticated request. */
        lastUsedAt: timestamp('last_used_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Optional client metadata for audit/display. */
        userAgent: text('user_agent'),
        /** Optional originating IP for audit/display. */
        ipAddress: text('ip_address')
    },
    (table) => [
        // "revoke all sessions for a user" would otherwise seq-scan.
        index('sessions_user_id_idx').on(table.userId)
    ]
);
