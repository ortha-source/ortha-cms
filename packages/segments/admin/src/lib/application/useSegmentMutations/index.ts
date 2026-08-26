import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';
import type {
    CreateSegmentInput,
    DeleteSegmentInput,
    UpdateSegmentInput
} from '../../infrastructure/segmentsGateway';

/**
 * Creates a segment, then refreshes the catalogue.
 *
 * The invalidation is the catalogue root rather than the one type's list,
 * because the type's `segmentCount` is on the *type* row — narrow it and the
 * directory keeps showing "3 segments" next to a list of four.
 */
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
 * Renames a segment, or changes the reader tags it matches.
 *
 * Editing `tags` is the operation the whole segment indirection exists for — a
 * plan renamed upstream is one row edited here, and every rule, grant and
 * projected row keeps working because none of them ever named a tag.
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

/** Deletes a segment nothing references. Refused server-side while in use. */
export function useDeleteSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: DeleteSegmentInput) =>
            httpSegmentsGateway.deleteSegment(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
    });
}
