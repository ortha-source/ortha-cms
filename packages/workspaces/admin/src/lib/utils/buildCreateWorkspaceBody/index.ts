import type { CreateWorkspaceBody, WizardSnapshot } from '../../types/wizard';

/**
 * Maps a {@link WizardSnapshot} to the `/api/workspaces` request body. Content
 * collapses to `{ mode: 'all' }` when the page-level decision is "All content";
 * otherwise the two resource selections ride along under `mode: 'specific'`.
 *
 * The "Skip & create" path passes a snapshot with empty content rather than
 * mutating wizard state, so a failed submit leaves the user's picks intact for
 * retry.
 */
export function buildCreateWorkspaceBody(
    snapshot: WizardSnapshot
): CreateWorkspaceBody {
    const { data, members, contentMode, collections, pages } = snapshot;

    return {
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description.trim(),
        color: data.color,
        members: members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            invited: m.invited ?? false
        })),
        content:
            contentMode === 'all'
                ? { mode: 'all' }
                : { mode: 'specific', collections, pages }
    };
}
