import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import { membersKeys } from '../../utils/membersKeys';
import { toMember, type MemberResponse } from '../../utils/toMember';

/**
 * Fetches one member's full view from `GET /api/users/:id`. Transport errors
 * normalize to `ApiError` so the layout can branch on `HTTP_STATUS.NOT_FOUND`
 * for a deleted/unknown member.
 */
async function fetchUserDetail(id: string): Promise<Member> {
    try {
        const { data } = await apiClient.get<MemberResponse>(`/users/${id}`);
        return toMember(data);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Fetches a single member for the user detail page. The result is shared with
 * every tab via the route's Outlet context, so the tabs never re-fetch. A 404
 * (unknown/deleted member) surfaces as the query's error so the layout can show
 * a not-found state. Disabled until the caller confirms `users:read`.
 */
export function useUserDetail(id: string, enabled = true) {
    return useQuery({
        queryKey: membersKeys.detail(id),
        queryFn: () => fetchUserDetail(id),
        enabled
    });
}
