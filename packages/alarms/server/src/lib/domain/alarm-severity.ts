/**
 * How loudly a rule speaks. Severity carries **no authority** — an `Error`
 * alarm does not block a save or a publish, and must never learn to
 * ([ADR-0015](../../../../../docs/adr/0015-alarms-are-non-blocking.md)). It
 * orders the list, colours the stripe, and tells an editor which of four open
 * findings to read first.
 */
export const ALARM_SEVERITY = {
    /** Worth knowing. A missing SEO description. */
    Info: 'info',
    /** Worth fixing before this ships. A published entry with no cover. */
    Warn: 'warn',
    /** Something is wrong now. A live record pointing at a draft. */
    Error: 'error'
} as const;

/** One of the {@link ALARM_SEVERITY} values. */
export type AlarmSeverity =
    (typeof ALARM_SEVERITY)[keyof typeof ALARM_SEVERITY];

/** Every severity, most severe first — the list order and the DTO's enum. */
export const ALARM_SEVERITIES: readonly AlarmSeverity[] = [
    ALARM_SEVERITY.Error,
    ALARM_SEVERITY.Warn,
    ALARM_SEVERITY.Info
];

/** Rank used to sort findings, highest first. */
export function severityRank(severity: AlarmSeverity): number {
    return ALARM_SEVERITIES.length - ALARM_SEVERITIES.indexOf(severity);
}

/** Narrowing guard for a value arriving from the database or the wire. */
export function isAlarmSeverity(value: unknown): value is AlarmSeverity {
    return ALARM_SEVERITIES.includes(value as AlarmSeverity);
}
