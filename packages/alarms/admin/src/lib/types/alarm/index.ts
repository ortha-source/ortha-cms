/** How loudly a rule speaks. Mirrors the server's `ALARM_SEVERITY`. */
export type AlarmSeverity = 'info' | 'warn' | 'error';

/** Severities, most severe first — the order the UI lists and sorts by. */
export const ALARM_SEVERITIES: readonly AlarmSeverity[] = [
    'error',
    'warn',
    'info'
];

/** The state of one finding. Mirrors the server's `FINDING_STATE`. */
export type FindingState = 'open' | 'resolved';

/** A rule as the admin renders it. */
export type AlarmRule = {
    id: string;
    contentType: string;
    /** How the rule is named in the alarms list. */
    name: string;
    /** What a finding of this rule says in the entry editor. */
    findingTitle: string;
    description: string | null;
    severity: AlarmSeverity;
    /** The stored filter tree, in the query builder's own JSON. */
    filter: unknown;
    enabled: boolean;
    /**
     * Why the stored filter no longer parses, when it does not. A broken rule
     * is shown as needing attention rather than quietly not firing — silently
     * never matching looks exactly like "everything is fine".
     */
    brokenReason: string | null;
    lastScanAt: string | null;
    openCount: number;
};

/** One finding, already joined to the rule that produced it. */
export type AlarmFinding = {
    ruleId: string;
    ruleName: string;
    /** The rule's finding title — what the editor reads. */
    title: string;
    contentType: string;
    entryId: string;
    severity: AlarmSeverity;
    state: FindingState;
    firstSeenAt: string;
    lastSeenAt: string;
};

/** A page of findings. */
export type AlarmFindingList = {
    items: AlarmFinding[];
    total: number;
    page: number;
    pageSize: number;
};

/** What one rescan did — shown as a toast after "Check now". */
export type AlarmScanResult = {
    ruleId: string;
    scanned: number;
    opened: number;
    resolved: number;
    open: number;
};

/** The rule editor's live readout: matches now, out of how many exist. */
export type AlarmRulePreview = {
    matched: number;
    total: number;
    sampleIds: string[];
};

/** Open counts for the workspace. */
export type AlarmSummary = {
    open: Record<AlarmSeverity, number>;
    openTotal: number;
};
