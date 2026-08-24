import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One in-flight SSO sign-in attempt: the `state`, `nonce` and PKCE verifier the
 * core minted, plus where to land the person afterwards.
 *
 * **A row, not a signed cookie.** `IdentityPluginConfig` documents the absence
 * of a signing secret in this plugin as a decision rather than an omission — an
 * earlier inert `sessionSecret` gave operators a rotation runbook that did
 * nothing. Keeping handshake state here holds that line: no key to configure,
 * no rotation procedure, and a sign-in that got stuck is a row somebody can
 * look at.
 *
 * `id` is the SHA-256 of the opaque token in the browser's cookie, exactly like
 * `sessions.id` — so a read-only database leak yields nothing that can resume
 * an attempt.
 */
export const ssoAuthRequests = pgTable(
    'sso_auth_requests',
    {
        /** SHA-256 (hex) of the app-generated request token. Not a uuid. */
        id: text('id').primaryKey(),
        /** The provider this attempt was started against. */
        provider: text('provider').notNull(),
        /**
         * The CSRF value sent to the provider and re-checked on return. Unique:
         * two live attempts must not share one, and the callback looks up by
         * the cookie first and compares this second.
         */
        state: text('state').notNull().unique(),
        /** The replay-defence value bound into the provider's identity token. */
        nonce: text('nonce').notNull(),
        /** The PKCE verifier, spent once at the token exchange. */
        codeVerifier: text('code_verifier').notNull(),
        /**
         * Where to send the person once they are signed in — already validated
         * as a same-origin absolute path by `safeRedirectPath`, so nothing
         * downstream has to validate it again.
         */
        redirectTo: text('redirect_to').notNull(),
        /**
         * The SHA-256 of an invite token, when this attempt was started from an
         * invite link — the "accept your invitation by signing in with your
         * work account" path.
         *
         * Null for an ordinary sign-in. Stored as a hash for the same reason
         * every other token in this plugin is: the raw value lives only in the
         * link the admin sent, and a read-only database leak yields nothing
         * that can redeem it.
         */
        inviteTokenHash: text('invite_token_hash'),
        /** Absolute expiry. Minutes, not days: this is one click long. */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        /**
         * Set when the attempt is spent. The one-time guarantee is a
         * conditional `UPDATE … WHERE consumed_at IS NULL RETURNING`, the same
         * write the invite and reset flows use — never a read-then-write.
         */
        consumedAt: timestamp('consumed_at', { withTimezone: true }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // Sweeping expired attempts, and the "is this state live?" lookup.
        index('sso_auth_requests_expires_at_idx').on(table.expiresAt)
    ]
);
