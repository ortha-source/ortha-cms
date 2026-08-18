/** Default page size for `GET /api/users`. */
export const DEFAULT_PAGE_SIZE = 10;

/** Upper bound on the requested page size (the largest option the UI offers). */
export const MAX_PAGE_SIZE = 100;

/**
 * Max length of the raw `?filter=` JSON string. A coarse first guard against
 * oversized payloads, ahead of the filter engine's node/depth caps.
 */
export const FILTER_MAX_LENGTH = 4096;

/**
 * How long after issuing an invite a **resend** is refused.
 *
 * Rotation is unconditionally destructive and the raw token is unrecoverable
 * (only its hash is stored), so the server cannot hand back the link it just
 * minted. Without a window, a double-clicked "Resend" rotates twice and the
 * admin can be left holding the *first* response's token — already dead. One
 * minute is long enough to cover a double-click or an impatient retry, short
 * enough that a genuine "that address bounced, try again" is barely delayed.
 */
export const INVITE_RESEND_COOLDOWN_SECONDS = 60;

/**
 * How long after issuing a password-reset link another one is refused.
 *
 * Same reasoning as {@link INVITE_RESEND_COOLDOWN_SECONDS}, and the same
 * failure it prevents: issuing is unconditionally destructive and the raw token
 * is unrecoverable, so a double-clicked "Generate link" mints a second token,
 * kills the first, and can leave the admin holding the *first* response's link
 * — already dead, with no sign that it is.
 */
export const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
