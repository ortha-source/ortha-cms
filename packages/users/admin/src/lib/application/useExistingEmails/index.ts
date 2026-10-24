import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Email } from '../../domain/value-objects/email';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

/**
 * Which of the invite sheet's addresses already belong to members, so the
 * chip can say so before the admin presses Send. Only well-formed addresses
 * are asked about (a malformed chip has its own error), and the answer is the
 * set of taken, lower-cased addresses.
 *
 * It reads the ordinary member list (`GET /api/users` with an `email in […]`
 * filter), so it asks nothing the roster does not already show this admin —
 * `enabled` is the caller's `users:read`. The server's batch `409` stays the
 * authority; this is the friendly early warning. Holds the previous answer
 * while a new chip is checked, so existing flags do not flicker.
 */
export function useExistingEmails(emails: readonly string[], enabled = true) {
    const candidates = emails.filter((email) => Email.isValid(email));
    return useQuery({
        queryKey: membersKeys.existingEmails(candidates),
        queryFn: async () =>
            new Set(await httpMemberGateway.existingEmails(candidates)),
        enabled: enabled && candidates.length > 0,
        placeholderData: keepPreviousData,
        staleTime: 30_000
    });
}
