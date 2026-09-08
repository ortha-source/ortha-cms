/** There is no open review request on this entry to withdraw. */
export class ReviewRequestNotFoundError extends Error {
    constructor(readonly entryId: string) {
        super(`No open review request on entry "${entryId}".`);
        this.name = 'ReviewRequestNotFoundError';
    }
}
