/**
 * Role keys an admin may assign through the users API — the three seeded
 * system roles. Kept as a plain tuple (not derived from `SYSTEM_ROLES`) so
 * `class-validator`'s `@IsIn` gets a readonly string array and the API
 * contract is explicit at a glance.
 */
export const ASSIGNABLE_ROLE_KEYS = ['admin', 'contributor', 'viewer'] as const;

/** A role key assignable via the users API. */
export type AssignableRoleKey = (typeof ASSIGNABLE_ROLE_KEYS)[number];

/** How long an invite token stays valid. */
export const INVITE_TOKEN_TTL_DAYS = 7;

/** Default page size for `GET /api/users`. */
export const DEFAULT_PAGE_SIZE = 10;

/** Upper bound on the requested page size. */
export const MAX_PAGE_SIZE = 50;
