import { CONTENT_SEGMENT, SHARED_SEGMENT } from '../constants';

/**
 * Absolute in-app path to one entry's editor,
 * `/workspaces/:workspaceId/content/:typeName/:id`. Built from
 * {@link CONTENT_SEGMENT} so the library mount path is never a magic literal —
 * used to deep-link a related record (e.g. the "open in a new tab" control on a
 * relation row) to its own editor.
 */
export function contentEntryPath(
    workspaceId: string,
    typeName: string,
    id: string
): string {
    return `/workspaces/${workspaceId}/${CONTENT_SEGMENT}/${typeName}/${id}`;
}

/**
 * The read-only list of one shared workspace's records of a type, relative to
 * the library's `basePath` (`/workspaces/:id/content`):
 * `…/:typeName/shared/:sourceId`. The one place the shape is spelled, for the
 * sidebar's "From {workspace}" rows, the shared-only notice and the route.
 */
export function sharedRecordsPath(
    basePath: string,
    typeName: string,
    sourceId: string
): string {
    return `${basePath}/${typeName}/${SHARED_SEGMENT}/${encodeURIComponent(sourceId)}`;
}
