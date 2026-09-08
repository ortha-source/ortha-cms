/**
 * The caller wrote the head revision, and the rule requires somebody else.
 *
 * This is the four-eyes switch, and it compares **user ids** — administrators
 * included, because an administrator writing and approving their own entry is
 * precisely the review the rule was bought to prevent. The sanctioned way past
 * it is the bypass, which is loud, reasoned and in the log.
 *
 * A **409** rather than a 403: the caller holds `content:approve` and the route
 * is theirs to call. What refuses them is the state of this entry — they wrote
 * the version they are trying to vote on — and a 403 would send them asking an
 * administrator for a permission they already have.
 */
export class SelfApprovalRefusedError extends Error {
    constructor(readonly revisionId: string) {
        super(
            'You wrote the current version of this entry, and its rule ' +
                'requires an approval from somebody else.'
        );
        this.name = 'SelfApprovalRefusedError';
    }
}
