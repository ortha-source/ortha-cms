/**
 * The shape of the one-time secret an invite or reset link carries: 64
 * lowercase hex characters — 32 random bytes, which is what the users plugin's
 * `InviteTokenService` and `PasswordResetTokenService` mint
 * (`randomBytes(32).toString('hex')`). Restated here for the same reason the
 * password rule is: the admin cannot import the server package, and a drift is
 * caught by the e2e suites, whose fixture tokens have this shape.
 */
const LINK_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Whether a token lifted from a link's `?token=` is **complete** — present and
 * shaped like a token at all — before anything is asked of the server.
 *
 * A link pasted through a chat app that cut it short, or copied with a
 * character missing, cannot be valid, and saying so needs no request: the page
 * can tell the holder *why* the link broke ("part of it may have been cut
 * off") instead of the generic "expired" a server `404` has to mean. It decides
 * nothing about a well-formed token — only the server knows whether that one
 * is live — so it leaks nothing either.
 */
export function isCompleteLinkToken(token: string | null | undefined): boolean {
    return !!token && LINK_TOKEN_PATTERN.test(token);
}
