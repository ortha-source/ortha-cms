import type { QueryKey } from '@tanstack/react-query';

/**
 * Segments of every cache built from the content registry: content's schema
 * list (under workspaces' content-access key), each type's schema and filter
 * fields, and the workspaces wizard's grant catalogue. A restart with a new
 * model makes all of them stale at once.
 */
const SEGMENTS = new Set([
    'content-schema',
    'content-schema-list',
    'content-filter-fields',
    'content-types'
]);

/** Whether a query holds something the registry decides. */
export const isRegistryKey = (key: QueryKey): boolean =>
    key.some((part) => typeof part === 'string' && SEGMENTS.has(part));
