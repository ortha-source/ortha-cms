/**
 * The entry's current version is the one already live, so there is nothing to
 * ask anybody to review.
 *
 * Protection gates `draft → published` and an approval belongs to a revision,
 * so a review is always about the version that would ship **next**. On a
 * published entry with no edits since, that version does not exist yet: an
 * approval of the head would approve what readers already have, and a request
 * would sit in the queue until somebody happened to publish again — which is
 * the only thing that closes one on its own.
 *
 * A **409** rather than a 403: the caller holds `content:update` and the route
 * is theirs to call. What refuses them is the state of this entry, and the
 * next save changes it.
 */
export class NothingToReviewError extends Error {
    constructor(readonly revisionId: string) {
        super(
            'This entry is published and has not changed since, so there is ' +
                'nothing to review. Save a change first.'
        );
        this.name = 'NothingToReviewError';
    }
}
