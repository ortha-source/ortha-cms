import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    httpSegmentsGateway,
    segmentsKeys,
    type CreateSegmentInput,
    type UpdateSegmentInput
} from '../infrastructure/segmentsGateway';

/** Permission to see who content is restricted to. Contributor and viewer hold it. */
export const SEGMENTS_READ = 'segments:read';
/** Permission to change it. Admin only. */
export const SEGMENTS_MANAGE = 'segments:manage';

/**
 * Every segment, optionally narrowed by a search term.
 *
 * `keepPreviousData` holds the rows while a new search resolves — a list that
 * empties between keystrokes reads as "no matches" rather than "still looking".
 *
 * Disabled until the caller confirms `segments:read`; the server would refuse
 * otherwise, and the entry editor mounts this on every entry open.
 */
export function useSegments(query?: string) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.list(query),
        queryFn: () => httpSegmentsGateway.listSegments(query),
        placeholderData: keepPreviousData,
        enabled: canRead
    });
}

/** Creates a segment, then refreshes the directory. */
export function useCreateSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSegmentInput) =>
            httpSegmentsGateway.createSegment(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
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
 */
export function useDeleteSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.deleteSegment(id),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
    });
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
