import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';
import type {
    CreateSegmentTypeInput,
    UpdateSegmentTypeInput
} from '../../infrastructure/segmentsGateway';

/**
 * Creating a type also creates its mask segment, so the invalidation is the
 * whole catalogue root rather than just the type list.
 */
export function useCreateSegmentType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSegmentTypeInput) =>
            httpSegmentsGateway.createType(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
    });
}

/** Renames a type or changes its rendering hint. */
export function useUpdateSegmentType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateSegmentTypeInput) =>
            httpSegmentsGateway.updateType(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: segmentsKeys.catalogue })
    });
}

/**
 * Retires a type — and invalidates **everything**, not just the catalogue.
 *
 * Retirement zeroes the type's projection slot, so every entry that type was
 * hiding becomes readable. Nothing else in the cache knows that: a rule's
 * conditions on the retired type are now inert, an entry's access chip is
 * stale, and both would keep rendering the old answer until something else
 * happened to refetch them. The blast radius of this one call is the reason it
 * is a separate hook from {@link useUpdateSegmentType} rather than a flag on it.
 */
export function useRetireSegmentType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpSegmentsGateway.retireType(id),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['segments'] })
    });
}
