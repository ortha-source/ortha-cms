import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    fetchMembers,
    membersKeys,
    type MembersListParams
} from '../membersApi';

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
