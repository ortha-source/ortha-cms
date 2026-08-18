import type { MemberWithResetToken } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { useMembersMutation } from '../useMembersMutation';

/**
 * Mints a one-time password-reset link for a member via the gateway (the server
 * rotates the token, invalidating any previous link). Resolves with the member
 * **and** the raw token, so the caller can show the link — minting without
 * handing the link over would leave the member with nothing and the admin with
 * a dead one. No cache invalidation: no list-visible field changes, exactly
 * like "resend invite". Errors normalize to `ApiError`, so a caller can branch
 * on `HTTP_STATUS.CONFLICT` for "not active" / "just issued".
 */
export function useIssuePasswordReset() {
    return useMembersMutation<string, MemberWithResetToken>(
        (id) => httpMemberGateway.issuePasswordReset(id),
        { invalidate: false }
    );
}
