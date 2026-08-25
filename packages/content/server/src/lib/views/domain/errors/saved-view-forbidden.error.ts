/**
 * The caller may read the view but not perform this write — editing or deleting
 * someone else's view, or sharing one without `views:share`. Distinct from
 * {@link SavedViewNotFoundError} because the view's existence is already known
 * to the caller (it is listed for them), so a 403 discloses nothing new.
 */
export class SavedViewForbiddenError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'SavedViewForbiddenError';
    }
}
