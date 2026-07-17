import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import {
    membersKeys,
    type MembersListParams
} from '../../infrastructure/membersKeys';

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count math before
 * the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Fetches one page of members via the member gateway. `keepPreviousData` holds
 * the current rows on screen while a new page or search resolves, so the table
 * doesn't flash empty between pages. Disabled until the caller confirms
 * `users:read`.
 */
export function useMembers(params: MembersListParams, enabled = true) {
    return useQuery({
        queryKey: membersKeys.list(params),
        queryFn: () => httpMemberGateway.list(params),
        placeholderData: keepPreviousData,
        enabled
    });
}
