import { useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

/**
 * The assignable roles and the permission keys each grants, for the role
 * dialog's "What changes" table. A deployment's system roles change only on a
 * release, so it is fetched once per session (`staleTime: Infinity`).
 */
export function useRoleCatalog(enabled = true) {
    return useQuery({
        queryKey: membersKeys.roles,
        queryFn: () => httpMemberGateway.listRoles(),
        staleTime: Infinity,
        enabled
    });
}
