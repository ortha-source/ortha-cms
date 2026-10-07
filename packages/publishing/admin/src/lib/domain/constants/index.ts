/**
 * Named constants of the publishing plugin — route segments, permissions and
 * slot item ids, so none of them is a magic literal at a call site.
 */

/** The page's route segment under a workspace: `/workspaces/:id/publish`. */
export const PUBLISH_SEGMENT = 'publish';

/** Permission required to publish — and so to open the manager at all. */
export const CONTENT_PUBLISH = 'content:publish';

/** Slot item ids (also React keys) for this plugin's contributions. */
export const SLOT_ITEM_ID = {
    Route: 'publishing.route',
    BulkAction: 'publishing.openSelection',
    EntryMenu: 'publishing.openEntry'
} as const;

/** The absolute path of the manager for a workspace (no search string). */
export function publishManagerPath(workspaceId: string): string {
    return `/workspaces/${workspaceId}/${PUBLISH_SEGMENT}`;
}
