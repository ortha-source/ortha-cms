import { useQuery } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';

/**
 * Every rule assignment in the open workspace — the workspace-level one, the
 * per-type ones, and every per-entry one.
 *
 * One list rather than a per-target lookup, because the entry editor needs all
 * three levels at once to say *why* an entry is restricted ("from the
 * collection", "from this workspace"), and a request per level per entry opened
 * would be three round trips to render a chip. A workspace's assignments are
 * counted in the hundreds at worst — the per-entry ones only exist where
 * somebody made one — so the whole list is the cheaper shape.
 */
export function useAssignments(workspaceId: string, enabled = true) {
    return useQuery({
        queryKey: segmentsKeys.assignments(workspaceId),
        queryFn: () => httpSegmentsGateway.listAssignments(),
        enabled: enabled && Boolean(workspaceId)
    });
}
