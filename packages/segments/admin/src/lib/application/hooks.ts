import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query';
import { useHasPermission } from '@orthacms/identity-admin';
import type { EntryAccess } from '../domain/types';
import {
    httpSegmentsGateway,
    segmentsKeys,
    type CreateSegmentInput,
    type SetEntryAccessInput,
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

/** One entry's lists. Two empty ones mean everyone. */
export function useEntryAccess(workspaceId: string, entryId?: string) {
    const canRead = useHasPermission(SEGMENTS_READ);
    return useQuery({
        queryKey: segmentsKeys.entry(workspaceId, entryId ?? ''),
        queryFn: () => httpSegmentsGateway.getEntryAccess(entryId as string),
        enabled: canRead && Boolean(workspaceId) && Boolean(entryId)
    });
}

/**
 * Replaces one entry's lists.
 *
 * The response **seeds the cache** rather than invalidating it: the server
 * returns the lists it stored, so there is nothing a refetch would learn — and
 * a refetch here would blank the control the editor is still looking at.
 */
export function useSetEntryAccess(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SetEntryAccessInput) =>
            httpSegmentsGateway.setEntryAccess(input),
        onSuccess: (access: EntryAccess, input) => {
            queryClient.setQueryData(
                segmentsKeys.entry(workspaceId, input.entryId),
                access
            );
        }
    });
}
