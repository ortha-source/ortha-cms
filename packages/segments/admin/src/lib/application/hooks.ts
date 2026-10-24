import { useCallback, useMemo } from 'react';
import {
    keepPreviousData,
    useMutation,
    useQueries,
    useQuery,
    useQueryClient,
    type QueryKey
} from '@tanstack/react-query';
import { useHasPermission } from '@orthacms/identity-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import { ApiError, markJustCreated } from '@orthacms/utils-admin';
import type { WorkspaceUsageItem } from '../domain/usage';
import {
    httpSegmentsGateway,
    segmentsKeys,
    type CreateSegmentInput,
    type ListSegmentsParams,
    type UpdateSegmentInput
} from '../infrastructure/segmentsGateway';

/** Permission to see who content is restricted to. Contributor and viewer hold it. */
export const SEGMENTS_READ = 'segments:read';
/** Permission to change it. Admin only. */
export const SEGMENTS_MANAGE = 'segments:manage';
/**
 * Permission to read content — which naming the entries an audience governs
 * is. Every system role holds it; the usage route asks for it beside
 * `segments:read`.
 */
export const CONTENT_READ = 'content:read';

/** The `justCreated` scope of the audience directory's table. */
export const SEGMENTS_SCOPE = 'segments';

/**
 * One page of the directory, narrowed by a search term and — in the entry
 * editor — by the open workspace.
 *
 * `keepPreviousData` holds the rows while a new page or search resolves: a list
 * that empties between keystrokes reads as "no matches" rather than "still
 * looking", and one that empties between pages reads as the end of the list.
 *
 * Disabled until the caller confirms `segments:read`; the server would refuse
 * otherwise, and the entry editor mounts this on every entry open.
 */
export function useSegments(params: ListSegmentsParams = {}) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.list(params),
        queryFn: () => httpSegmentsGateway.listSegments(params),
        placeholderData: keepPreviousData,
        enabled: canRead
    });
}

/**
 * Named segments, whatever page they would fall on.
 *
 * For the components that hold **ids** rather than a page — the entry header
 * chip and a revision's captured access. A paginated directory cannot serve
 * them: the first page is not where their ids necessarily are, and reading a
 * miss as "deleted" would slander an audience that is merely on page three.
 */
export function useSegmentLookup(ids: readonly string[]) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.lookup(ids),
        queryFn: () => httpSegmentsGateway.lookupSegments(ids),
        enabled: canRead && ids.length > 0
    });
}

/** One segment, for the editor page. Disabled while creating. */
export function useSegment(id?: string) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.detail(id ?? ''),
        queryFn: () => httpSegmentsGateway.getSegment(id as string),
        enabled: canRead && Boolean(id)
    });
}

/** Creates a segment, then refreshes the directory. */
export function useCreateSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSegmentInput) =>
            httpSegmentsGateway.createSegment(input),
        onSuccess: (created) => {
            // The editor goes back to the directory, which flashes this row.
            markJustCreated(SEGMENTS_SCOPE, created.id);
            return queryClient.invalidateQueries({
                queryKey: segmentsKeys.catalogue
            });
        }
    });
}

/**
 * Renames a segment, or changes the tags it answers to.
 *
 * The invalidation is the **whole** `segments` root, which covers open
 * entries' cached lists as well as the directory. That is deliberate: the
 * labels an entry's rows are drawn with come from the directory, so a rename
 * that refreshed only the list would leave the editor showing the old name.
 */
export function useUpdateSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateSegmentInput) =>
            httpSegmentsGateway.updateSegment(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
    });
}

/**
 * Deletes a segment.
 *
 * The server also drops it from every entry that named it, in one transaction —
 * so every cached entry answer is stale, and the invalidation has to be the
 * root rather than the list.
 *
 * **Except the deleted segment's own reads.** Its page is still mounted while
 * the delete settles (it navigates away on success), and refetching its detail
 * and usage there would answer 404 and paint the page's load error for a frame
 * over an action that worked. They are left to be collected instead.
 */
export function useDeleteSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.deleteSegment(id),
        onSuccess: (_result, id) =>
            queryClient.invalidateQueries({
                queryKey: segmentsKeys.catalogue,
                predicate: (query) => !isAboutSegment(query.queryKey, id)
            })
    });
}

/** Whether a key is one segment's own detail or usage read. */
function isAboutSegment(key: QueryKey, id: string): boolean {
    return (
        key[0] === 'segments' &&
        (key[1] === 'detail' || key[1] === 'usage') &&
        key[2] === id
    );
}

/** What {@link useSegmentUsage} answers, merged across workspaces. */
export type SegmentUsageResult = {
    /** Every listed entry, each with the workspace it was read from. */
    items: WorkspaceUsageItem[];
    /** Every entry naming the audience in the workspaces that answered. */
    total: number;
    /** Whether some workspace named more entries than it listed. */
    truncated: boolean;
    /** Whether the reads are allowed at all (`segments:read` + `content:read`). */
    enabled: boolean;
    isPending: boolean;
    /** A workspace read failed for a reason other than "not yours". */
    isError: boolean;
    refetch: () => void;
};

/**
 * Where one segment is used — across every workspace the caller can open.
 *
 * The usage route is **workspace-scoped** (an entry's title is content, and
 * content belongs to one workspace), while the audience pages are not inside
 * any workspace. So this asks each workspace the caller can see, one request
 * apiece, and merges the answers. An installation has a handful of workspaces;
 * a route answering for all of them at once would have to re-derive membership
 * the `WorkspaceGuard` already decides.
 *
 * A **403** from one workspace is "not a member", not a failure — that
 * workspace's entries are simply not the caller's to see, and the delete
 * dialog counts them as elsewhere. Anything else is an error.
 */
export function useSegmentUsage(segmentId?: string): SegmentUsageResult {
    const canRead = useHasPermission(SEGMENTS_READ);
    const canReadContent = useHasPermission(CONTENT_READ);
    const enabled = canRead && canReadContent && Boolean(segmentId);
    const workspaces = useWorkspaces();
    const list = useMemo(() => workspaces.data ?? [], [workspaces.data]);

    const results = useQueries({
        queries: list.map((workspace) => ({
            queryKey: segmentsKeys.usage(segmentId ?? '', workspace.id),
            queryFn: () =>
                httpSegmentsGateway.getSegmentUsage(
                    segmentId as string,
                    workspace.id
                ),
            enabled,
            // "Not your workspace" will not change on a retry.
            retry: (count: number, error: unknown) =>
                !isForbidden(error) && count < 2
        }))
    });

    const refetchAll = workspaces.refetch;
    const refetch = useCallback(() => {
        void refetchAll();
        for (const result of results) void result.refetch();
    }, [refetchAll, results]);

    const items: WorkspaceUsageItem[] = [];
    let total = 0;
    let truncated = false;
    let isError = enabled && workspaces.isError;
    let isPending = enabled && workspaces.isPending;
    results.forEach((result, index) => {
        const workspace = list[index];
        if (!workspace) return;
        if (result.isError) {
            if (!isForbidden(result.error)) isError = true;
            return;
        }
        if (result.isPending) {
            isPending = isPending || enabled;
            return;
        }
        total += result.data.total;
        truncated = truncated || result.data.truncated;
        for (const item of result.data.items) {
            items.push({
                ...item,
                workspaceId: workspace.id,
                workspaceName: workspace.name
            });
        }
    });

    return { items, total, truncated, enabled, isPending, isError, refetch };
}

/** Whether a failed read was the server saying "not yours". */
function isForbidden(error: unknown): boolean {
    return error instanceof ApiError && error.status === 403;
}

/**
 * One entry's lists. Two empty ones mean everyone.
 *
 * `version` is the entry row's `updatedAt`. Pass it: access is written by the
 * entry's own save now, so it changes on paths this plugin never sees — a
 * restore most of all — and a key that ignored the row's version would answer
 * from a cache the entry has moved on from.
 */
export function useEntryAccess(
    workspaceId: string,
    entryId?: string,
    version?: string
) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.entry(workspaceId, entryId ?? '', version),
        queryFn: () => httpSegmentsGateway.getEntryAccess(entryId as string),
        enabled: canRead && Boolean(workspaceId) && Boolean(entryId)
    });
}

/**
 * There is deliberately **no write hook here.**
 *
 * An entry's audiences are written by the entry's own save — staged by the
 * Access tab, sent in the save body's `extensions` bag, applied by the server
 * inside the save's transaction and captured by the revision it appends. A
 * mutation of its own would be a second, later write: not atomic with the
 * record, and invisible to the version, which is exactly what this design set
 * out to fix. The `PUT /segments/entries/:entryId` route still exists for an API
 * client that is not saving an entry; the admin is not that client.
 */
