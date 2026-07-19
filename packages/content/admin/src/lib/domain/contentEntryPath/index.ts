import { CONTENT_SEGMENT } from '../constants';

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
