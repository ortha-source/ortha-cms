import { useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

/**
 * Fetches a single member for the user detail page via the gateway. The result
 * is shared with every tab via the route's Outlet context, so the tabs never
 * re-fetch. A 404 (unknown/deleted member) surfaces as the query's `ApiError`
 * so the layout can show a not-found state. Disabled until the caller confirms
 * `users:read`.
 */
export function useUserDetail(id: string, enabled = true) {
    return useQuery({
        queryKey: membersKeys.detail(id),
        queryFn: () => httpMemberGateway.get(id),
        enabled
    });
}
