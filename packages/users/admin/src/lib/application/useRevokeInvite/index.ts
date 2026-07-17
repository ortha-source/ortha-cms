import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { useMembersMutation } from '../useMembersMutation';

/**
 * Revokes a pending invite via the gateway — the row disappears from the list
 * (the server deletes the placeholder account). Invalidates the members cache
 * on success. Errors normalize to `ApiError`.
 */
export function useRevokeInvite() {
    return useMembersMutation<string, void>((id) =>
        httpMemberGateway.revokeInvite(id)
    );
}
