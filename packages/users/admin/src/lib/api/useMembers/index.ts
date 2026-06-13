import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { MemberList } from '../../types/member';
import { membersKeys, type MembersListParams } from '../../utils/membersKeys';
import { toMember, type MemberResponse } from '../../utils/toMember';

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count math before
 * the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 10;

/** The paginated envelope returned by `GET /api/users`. */
type MemberListResponse = {
    items: MemberResponse[];
    total: number;
    page: number;
    pageSize: number;
};

/** Fetches one page of members from `GET /api/users`. */
async function fetchMembers(params: MembersListParams): Promise<MemberList> {
    const { data } = await apiClient.get<MemberListResponse>('/users', {
        params
    });
    return {
        items: data.items.map(toMember),
        total: data.total,
        page: data.page,
        pageSize: data.pageSize
    };
}

/**
 * Fetches one page of members. `keepPreviousData` holds the current rows on
 * screen while a new page or search resolves, so the table doesn't flash
 * empty between pages. Disabled until the caller confirms `users:read`.
 */
export function useMembers(params: MembersListParams, enabled = true) {
    return useQuery({
        queryKey: membersKeys.list(params),
        queryFn: () => fetchMembers(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
