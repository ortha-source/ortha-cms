/** Limits and scope rules for saved list views. */

/** Longest accepted view name. */
export const VIEW_NAME_MAX_LENGTH = 80;

/**
 * Longest accepted `scope` key. A scope names the list a view belongs to —
 * `content:<typeName>` today, `users:members` when the switcher reaches the
 * other list pages. Kept generous enough for a long content-type name.
 */
export const VIEW_SCOPE_MAX_LENGTH = 128;

/**
 * The scopes this endpoint accepts, as a prefix. v1 only serves content
 * collections; anything else is refused at the DTO so a typo can't quietly
 * create a view nothing will ever read.
 */
export const CONTENT_SCOPE_PREFIX = 'content:';

/** Max columns a payload may pin — bounds the stored array. */
export const VIEW_MAX_COLUMNS = 100;

/** Max length of one column id inside a payload. */
export const VIEW_COLUMN_MAX_LENGTH = 128;

/** Max slot-owned list params (`extra`) a payload may carry. */
export const VIEW_MAX_EXTRA_KEYS = 20;

/** Max length of an `extra` key or value. */
export const VIEW_EXTRA_MAX_LENGTH = 255;

/** Max saved views one user may hold in a single workspace + scope. */
export const VIEW_MAX_PER_SCOPE = 100;
