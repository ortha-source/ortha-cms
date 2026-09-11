/**
 * A review was requested of somebody who cannot give one — not a member of the
 * workspace, not holding `content:approve`, or the person asking.
 *
 * One error for all three, and it names nobody: the picker only ever offers
 * people who can review, so a request that reaches this was built by hand, and
 * telling "not a member" from "cannot approve" would let it probe the roster.
 * Answered **422**: the request is well-formed, what it asks for is not
 * possible.
 */
export class ReviewerNotEligibleError extends Error {
    constructor() {
        super(
            'Every requested reviewer must be another member of this ' +
                'workspace who can approve content.'
        );
        this.name = 'ReviewerNotEligibleError';
    }
}
