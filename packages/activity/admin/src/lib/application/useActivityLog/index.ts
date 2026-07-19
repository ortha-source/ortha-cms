import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { httpActivityGateway } from '../../infrastructure/httpActivityGateway';
import {
    activityKeys,
    type ActivityListParams
} from '../../infrastructure/activityKeys';

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count math before
 * the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Fetches one page of audit events via the activity gateway. `keepPreviousData`
 * holds the current rows on screen while a new page or filter resolves, so the
 * table doesn't flash empty. Disabled until the caller confirms `activity:read`.
 */
export function useActivityLog(params: ActivityListParams, enabled = true) {
    return useQuery({
        queryKey: activityKeys.list(params),
        queryFn: () => httpActivityGateway.list(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
