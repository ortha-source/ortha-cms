/**
 * No rule with this id in this workspace. Transport-agnostic — the controller
 * maps it to a 404.
 */
export class AlarmRuleNotFoundError extends Error {
    constructor(readonly ruleId: string) {
        super(`Alarm rule "${ruleId}" not found.`);
        this.name = 'AlarmRuleNotFoundError';
    }
}
