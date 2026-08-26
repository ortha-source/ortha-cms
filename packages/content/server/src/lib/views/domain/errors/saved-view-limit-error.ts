import { VIEW_MAX_PER_SCOPE } from '../../views.constants';

/**
 * The caller has hit {@link VIEW_MAX_PER_SCOPE} views for one workspace + scope.
 * A bound rather than a business rule: it keeps one account from filling the
 * table, and the number is far above any realistic list of saved slices.
 */
export class SavedViewLimitError extends Error {
    constructor() {
        super(`You can save at most ${VIEW_MAX_PER_SCOPE} views for one list.`);
        this.name = 'SavedViewLimitError';
    }
}
