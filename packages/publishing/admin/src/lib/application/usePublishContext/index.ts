import { useQuery } from '@tanstack/react-query';
import { fetchPublishContext } from '@orthacms/content-admin';
import type { PublishSet } from '../../domain/publishSet';

/** Query key of one set's publish context, workspace-scoped. */
export const publishContextKey = (
    workspaceId: string,
    set: PublishSet | null,
    version: number
) =>
    [
        'publishing-context',
        workspaceId,
        set?.type ?? '',
        set?.ids ?? [],
        version
    ] as const;

/**
 * What publishing the set would involve — each entry described, plus the
 * drafts it links to — read through content's `bulk/publish/context`.
 *
 * **Not refetched on window focus.** The page re-derives its records from this
 * answer and carries the reader's picks across; a refetch the reader did not
 * ask for, landing while they tick boxes, is a surprise at best. `version`
 * (bumped after each commit) is the refetch that matters.
 */
export function usePublishContext(
    workspaceId: string,
    set: PublishSet | null,
    version: number,
    enabled: boolean
) {
    return useQuery({
        queryKey: publishContextKey(workspaceId, set, version),
        enabled: enabled && !!set,
        refetchOnWindowFocus: false,
        // A failed read here is the whole page — say so after one retry
        // rather than parking the reader on a skeleton for the default ladder.
        retry: 1,
        queryFn: () =>
            fetchPublishContext(
                (set as PublishSet).type,
                (set as PublishSet).ids
            )
    });
}
