import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import {
    segmentsKeys,
    type SegmentsListParams
} from '../../infrastructure/segmentsKeys';

/**
 * One type's segments, optionally narrowed by a search term.
 *
 * `keepPreviousData` holds the current rows while a new search resolves — on a
 * high-cardinality type the picker is typed into, and a list that empties
 * between keystrokes reads as "no matches" rather than "still looking".
 *
 * `typeKey` may be undefined before a type is selected; the query stays
 * disabled until it is, so the picker has no half-formed request to cancel.
 */
export function useSegments(
    typeKey: string | undefined,
    params: SegmentsListParams = {},
    enabled = true
) {
    return useQuery({
        queryKey: segmentsKeys.segments(typeKey ?? '', params),
        queryFn: () =>
            httpSegmentsGateway.listSegments(typeKey as string, params),
        placeholderData: keepPreviousData,
        enabled: enabled && Boolean(typeKey)
    });
}
