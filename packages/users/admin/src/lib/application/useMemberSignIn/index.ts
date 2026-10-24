import { useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

/**
 * How a member signs in — a password, linked SSO providers — for the member
 * page's "Sign-in" card. The server gates it on `users:update`, so pass that
 * as `enabled`; without it the card is not shown at all.
 */
export function useMemberSignIn(id: string, enabled = true) {
    return useQuery({
        queryKey: membersKeys.signIn(id),
        queryFn: () => httpMemberGateway.getSignIn(id),
        enabled
    });
}
