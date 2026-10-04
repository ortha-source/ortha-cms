/**
 * Envelope columns the platform owns. Reserved unconditionally — even the
 * flag-gated `published_at` / `deleted_at` — so a field name can never collide
 * with a column the platform might add, and these names mean one thing.
 */
export const RESERVED_COLUMNS: ReadonlySet<string> = new Set([
    'id',
    'workspace_id',
    'status',
    'created_at',
    'updated_at',
    'published_at',
    'deleted_at',
    'locale',
    'locale_group_id'
]);
