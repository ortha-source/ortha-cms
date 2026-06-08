import { sql } from 'drizzle-orm';
import {
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { roles } from './roles';

/** Account lifecycle states. */
export const userStatus = pgEnum('user_status', [
    'pending',
    'active',
    'disabled'
]);

/**
 * A person who can authenticate. Holds exactly one GLOBAL role
 * (roles → users is 1:N); workspace membership is tracked separately
 * and carries no role of its own.
 */
export const users = pgTable(
    'users',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Login identifier. Uniqueness is enforced case-insensitively at
         * the DB level (see index below); store lower-cased anyway.
         */
        email: text('email').notNull(),
        /** Display name. Null until the user sets one (e.g. on invite accept). */
        name: text('name'),
        /** Password hash. Null until an invite is accepted. Never plaintext. */
        passwordHash: text('password_hash'),
        /** The user's single global role. */
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id),
        /** Account lifecycle state. */
        status: userStatus('status').notNull().default('pending'),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last-modified timestamp; refreshed on every update. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (table) => [
        // Case-insensitive uniqueness enforced by the DB, without needing
        // the citext extension.
        uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`)
    ]
);
