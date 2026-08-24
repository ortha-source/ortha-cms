/**
 * No finding for this (rule, entry) pair. Transport-agnostic — the controller
 * maps it to a 404.
 */
export class AlarmFindingNotFoundError extends Error {
    constructor(
        readonly ruleId: string,
        readonly entryId: string
    ) {
        super(`No finding for rule "${ruleId}" on entry "${entryId}".`);
        this.name = 'AlarmFindingNotFoundError';
    }
}
