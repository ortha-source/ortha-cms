import { useMemo } from 'react';
import type { SharedSource } from '../../domain/types/workspace';
import { useContentTypes } from '../useContentTypes';
import { useWorkspaces } from '../useWorkspaces';

/** What {@link useSharedSourceCandidates} returns. */
export type SharedSourceCandidates = {
    /** The shared workspaces a new workspace could be granted content from. */
    sources: SharedSource[];
    /** Whether either underlying read is still loading. */
    isPending: boolean;
    /** Whether either underlying read failed. */
    isError: boolean;
};

/**
 * The shared workspaces the **create wizard** can offer content from.
 *
 * `GET /workspaces/:id/shared-sources` answers for a workspace that exists, and
 * the one being created does not yet — so the wizard derives the same shape
 * from what it already holds: the active, shared workspaces in the (membership-
 * scoped) workspaces list, each with its own granted types, their kinds read
 * from the content-type catalogue. A shared workspace the creator is not a
 * member of is therefore not offered here; it can still be granted from the
 * settings tab once the workspace exists.
 */
export function useSharedSourceCandidates(): SharedSourceCandidates {
    const workspaces = useWorkspaces();
    const catalog = useContentTypes();

    const sources = useMemo(() => {
        const kinds = new Map(
            (catalog.data ?? []).map((type) => [type.name, type.kind])
        );
        return (workspaces.data ?? [])
            .filter(
                (workspace) =>
                    workspace.isShared && workspace.status === 'Active'
            )
            .map((workspace) => ({
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                content: workspace.content
                    // A slug the catalogue no longer knows can't be granted.
                    .filter((slug) => kinds.has(slug))
                    .map((slug) => ({
                        slug,
                        kind: kinds.get(slug) ?? 'collection'
                    }))
            }))
            .filter((source) => source.content.length > 0);
    }, [workspaces.data, catalog.data]);

    return {
        sources,
        isPending: workspaces.isPending || catalog.isPending,
        isError: workspaces.isError || catalog.isError
    };
}
