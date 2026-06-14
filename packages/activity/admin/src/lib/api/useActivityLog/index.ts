import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { ActivityList } from '../../types/activityEvent';
import {
    activityKeys,
    type ActivityListParams
} from '../../utils/activityKeys';
import {
    toActivityEvent,
    type ActivityEventResponse
} from '../../utils/toActivityEvent';

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count math before
 * the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 25;

/** The paginated envelope returned by `GET /api/activity`. */
type ActivityListResponse = {
    items: ActivityEventResponse[];
    total: number;
    page: number;
    pageSize: number;
};

/** Fetches one page of audit events from `GET /api/activity`. */
async function fetchActivity(
    params: ActivityListParams
): Promise<ActivityList> {
    const { data } = await apiClient.get<ActivityListResponse>('/activity', {
        params
    });
    return {
        items: data.items.map(toActivityEvent),
        total: data.total,
        page: data.page,
        pageSize: data.pageSize
    };
}

/**
 * Fetches one page of audit events. `keepPreviousData` holds the current rows
 * on screen while a new page or filter resolves, so the table doesn't flash
 * empty. Disabled until the caller confirms `activity:read`.
 */
export function useActivityLog(params: ActivityListParams, enabled = true) {
    return useQuery({
        queryKey: activityKeys.list(params),
        queryFn: () => fetchActivity(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
