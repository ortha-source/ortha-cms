import { useQuery } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';

/**
 * Every segment type, installation-wide.
 *
 * Read by four surfaces — the directory page, the rule editor, the entry chip
 * and the entry tab — which is exactly why it is one cached query rather than a
 * prop threaded down: the entry editor's chip must not issue a request per
 * entry opened, and TanStack's dedupe is what makes that free.
 *
 * Disabled until the caller confirms `access:read`; the server would refuse
 * otherwise, and a 403 per entry open is noise in the console rather than
 * information.
 */
export function useSegmentTypes(enabled = true) {
    return useQuery({
        queryKey: segmentsKeys.types(),
        queryFn: () => httpSegmentsGateway.listTypes(),
        enabled
    });
}
