import type { AlarmSeverity } from '../domain/alarm-severity';
import type { FindingState } from '../domain/finding-state';

/**
 * The wire shape of a rule. Kept as its own contract rather than the Drizzle
 * row type: the admin reads this, and a column rename should not be an admin
 * change.
 */
export interface AlarmRuleView {
    id: string;
    contentType: string;
    name: string;
    /** Title a finding of this rule shows in the entry editor. */
    findingTitle: string;
    description: string | null;
    severity: AlarmSeverity;
    /** The stored filter tree, in the query builder's own JSON. */
    filter: unknown;
    enabled: boolean;
    /** Set when the stored filter no longer parses against its type. */
    brokenReason: string | null;
    lastScanAt: string | null;
    /**
     * Who created the rule, by user id — `null` for a rule written by a
     * system path. An id rather than a name: the admin already holds the
     * workspace's roster, and a name stored here would go stale the day the
     * person renamed themselves.
     */
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
    /** Findings currently open (i.e. not resolved). */
    openCount: number;
}

/**
 * What `PATCH /alarms/rules/:id` answers with: the rule after the write, and
 * the rescan the write caused, when it caused one.
 *
 * `scan` is `null` when nothing about the write could change which entries
 * match — a rename, a new severity — so the editor can say "checked 842, 38
 * flagged, 2 cleared" when there is something to say and stay quiet when there
 * is not, without guessing which of the two happened.
 */
export interface AlarmRuleUpdatedView extends AlarmRuleView {
    scan: AlarmScanResultView | null;
}

/** One finding, joined to the rule that produced it. */
export interface AlarmFindingView {
    ruleId: string;
    ruleName: string;
    /** The rule's finding title — what the editor reads. */
    title: string;
    contentType: string;
    entryId: string;
    severity: AlarmSeverity;
    state: FindingState;
    detail: unknown;
    firstSeenAt: string;
    lastSeenAt: string;
    /**
     * The entry's display title — its first non-empty short text field, the
     * same rule content's own `entryTitle` applies. Present on the paged list
     * only, `null` when the entry has none (or has gone): the page then names
     * it by id, which is honest, rather than inventing a label.
     */
    entryTitle?: string | null;
}

/** A page of findings. */
export interface AlarmFindingListView {
    items: AlarmFindingView[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * What one rescan did. Returned by the rescan route and shown as a toast, so
 * pressing "Check now" says something more useful than "done".
 */
export interface AlarmScanResultView {
    ruleId: string;
    /** Entries examined. */
    scanned: number;
    /** Findings that were not open before and are now. */
    opened: number;
    /** Findings that stopped matching and were closed. */
    resolved: number;
    /** Total open findings for this rule after the scan. */
    open: number;
}

/**
 * The rule editor's live preview: how many entries the draft filter matches,
 * out of how many the workspace holds. The denominator is what turns a number
 * into a judgement about whether the rule is too broad.
 */
export interface AlarmRulePreviewView {
    matched: number;
    total: number;
    /** First few matching ids, so the editor can show what it caught. */
    sampleIds: string[];
    /**
     * The same entries with their display titles, in the same order — what the
     * editor actually lists under "Right now". `title` is `null` for an entry
     * with no title-eligible value.
     */
    sample: AlarmPreviewSampleView[];
}

/** One entry a candidate filter matches, as the rule editor lists it. */
export interface AlarmPreviewSampleView {
    id: string;
    title: string | null;
}

/**
 * Open findings for a set of entries, keyed by entry id — the batch the
 * records-table column and the editor widget both read, one request per page
 * rather than one per row.
 */
export interface AlarmFindingsByEntryView {
    byEntry: Record<string, AlarmFindingView[]>;
}
