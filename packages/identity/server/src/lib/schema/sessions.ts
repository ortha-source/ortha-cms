import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Server-side, revocable session (FR-4). `id` is the SHA-256 of the opaque
 * random token handed to the client (application-generated, never derived or
 * predictable). The raw token lives only in the client's cookie and is never
 * stored, so a read-only DB/backup leak yields no usable session tokens.
 */
export const sessions = pgTable(
    'sessions',
    {
        /** SHA-256 (hex) of the app-generated session token. Not a uuid. */
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
