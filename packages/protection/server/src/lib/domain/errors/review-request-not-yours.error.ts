/**
 * Somebody other than the requester tried to withdraw a review request.
 *
 * Withdrawing is retracting *someone else's* ask, so it stays with the person
 * who made it and with an administrator — a reviewer who thinks a request was
 * premature declines to approve, which is what `changes_requested` is for.
 * Letting any contributor clear the queue would make the queue a shared inbox
 * anybody can empty.
 */
export class ReviewRequestNotYoursError extends Error {
    constructor(readonly requestId: string) {
        super(
            'Only the person who asked for this review, or an administrator, ' +
                'may withdraw it.'
        );
        this.name = 'ReviewRequestNotYoursError';
    }
}
