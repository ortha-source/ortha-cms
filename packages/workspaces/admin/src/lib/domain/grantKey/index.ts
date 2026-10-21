/**
 * The identity of one content grant — the slug for a workspace's **own** grant,
 * the slug and source for a grant from a shared workspace (the same type can
 * be granted from both). One rule for the granted-content rows, the dialogs
 * that exclude what is already granted, and the "just granted" highlight.
 */
export function grantKey(slug: string, sourceWorkspaceId?: string): string {
    return sourceWorkspaceId ? `${slug}@${sourceWorkspaceId}` : slug;
}
