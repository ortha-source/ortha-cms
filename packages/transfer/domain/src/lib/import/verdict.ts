/**
 * What an import **would** do, said one record at a time.
 *
 * Import is two-phase by design: a dry run produces these verdicts and writes
 * nothing, the reader looks at them, and only then does the same pipeline run
 * for real. The vocabulary is shared by both phases so the preview cannot
 * describe a decision the apply pass would make differently.
 */

/** What an import decided to do with one record. */
export const IMPORT_ACTION = {
    Create: 'create',
    Update: 'update',
    Skip: 'skip',
    Error: 'error'
} as const;

/** What an import decided to do with one record. */
export type ImportAction = (typeof IMPORT_ACTION)[keyof typeof IMPORT_ACTION];

/**
 * Why a record got the action it got. A stable code rather than a sentence:
 * the admin owns the wording (and its translations), the server owns the fact.
 */
export const IMPORT_REASON = {
    /** No row in the target matched — it will be created. */
    New: 'new',
    /** A row matched the natural key. */
    Matched: 'matched',
    /** Matched, and the policy says leave it alone. */
    ConflictSkipped: 'conflict-skipped',
    /** Matched, and the policy says write a second copy anyway. */
    ConflictDuplicated: 'conflict-duplicated',
    /** The type resolved no identity fields, so nothing could be matched on. */
    NoIdentity: 'no-identity',
    /** Related record: matched something already here, so it was linked to. */
    RelationLinked: 'relation-linked',
    /** Related record: written as a fresh copy because the policy says so. */
    RelationRecreated: 'relation-recreated',
    /** The document names a type this installation doesn't have. */
    UnknownType: 'unknown-type',
    /** The document names a field the type doesn't have. */
    UnknownField: 'unknown-field',
    /** Field validation refused the values. */
    ValidationFailed: 'validation-failed',
    /** One or more references named records that couldn't be found. */
    UnresolvedRelations: 'unresolved-relations',
    /** The record is context (depth 1) and its own record failed. */
    DependencyFailed: 'dependency-failed',
    /** An asset referenced by the record was not in the archive. */
    MissingAsset: 'missing-asset',
    /** The caller lacks the permission this record's action needs. */
    Forbidden: 'forbidden'
} as const;

/** Why a record got the action it got. */
export type ImportReason = (typeof IMPORT_REASON)[keyof typeof IMPORT_REASON];

/** What to do when an incoming record matches one that already exists. */
export const CONFLICT_POLICY = {
    /** Leave the existing row untouched. The default — it cannot lose data. */
    Skip: 'skip',
    /** Overwrite the existing row's values. */
    Update: 'update',
    /** Create a second row regardless of the match. */
    Duplicate: 'duplicate',
    /** Refuse the whole run on the first match. */
    Fail: 'fail'
} as const;

/** What to do when an incoming record matches one that already exists. */
export type ConflictPolicy =
    (typeof CONFLICT_POLICY)[keyof typeof CONFLICT_POLICY];

/** Every conflict policy, for validating a wire value. */
export const CONFLICT_POLICIES = Object.values(
    CONFLICT_POLICY
) as ConflictPolicy[];

/**
 * What to do with the **related** records a document carries — the depth-1 ones
 * pulled in because something the caller selected pointed at them.
 *
 * They need their own answer, separate from {@link CONFLICT_POLICY}. Nobody
 * asked for them: they are context for the records that *were* asked for, and
 * the usual reason they are in the file at all is so the links can be made
 * again on the other side. The overwhelmingly common intent is therefore
 * "point at the author who is already here", not "write a second author" — and
 * a single policy covering both depths cannot express that, because the same
 * word has to mean two different things at once.
 */
export const RELATION_POLICY = {
    /**
     * Match it and link to it, leaving the existing row's values alone. Only a
     * related record nothing matched is created — otherwise the link would
     * dangle. The default: it is what "export an article with its author, then
     * import it" is nearly always meant to do, and it cannot lose data.
     */
    Link: 'link',
    /** Match it and link to it, and overwrite its values from the file. */
    Update: 'update',
    /**
     * Never match: write a new row for every related record and point the links
     * at those. For a target whose same-named rows are genuinely different
     * things from the source's.
     */
    Recreate: 'recreate'
} as const;

/** What to do with the related records a document carries. */
export type RelationPolicy =
    (typeof RELATION_POLICY)[keyof typeof RELATION_POLICY];

/** Every relation policy, for validating a wire value. */
export const RELATION_POLICIES = Object.values(
    RELATION_POLICY
) as RelationPolicy[];

/** The verdict for one record. */
export interface ImportVerdict {
    $type: string;
    /** Source row id, so a verdict can be traced back to its document line. */
    $id: string;
    /**
     * How to name this record to a person — the first key value, or the first
     * text field, or the source id as a last resort.
     */
    label: string;
    /** Locale slug, for a row of a localized type. */
    locale?: string;
    action: ImportAction;
    reason: ImportReason;
    /** The existing row this would update, when one matched. */
    targetId?: string;
    /**
     * References that resolved to nothing, as `type:key` strings. Reported
     * rather than fatal: a link that can't be made is a missing link, not a
     * reason to refuse the record that carries it.
     */
    unresolved?: string[];
    /** Validation messages, when {@link IMPORT_REASON.ValidationFailed}. */
    issues?: string[];
}

/** Totals across a run — what a dialog shows above the per-record list. */
export interface ImportCounts {
    create: number;
    update: number;
    skip: number;
    error: number;
    /** Assets whose bytes would be uploaded. */
    assetsNew: number;
    /** Assets matched to something the workspace already holds. */
    assetsReused: number;
}

/** The dry run's whole answer. */
export interface ImportPreview {
    /** Document format version, echoed so a mismatch is visible up front. */
    version: number;
    counts: ImportCounts;
    verdicts: ImportVerdict[];
    /**
     * Whether anything at all would change. A run of pure skips is not an
     * error, but offering "Import" for it is a lie.
     */
    hasChanges: boolean;
}

/** What actually happened, once the run was applied. */
export interface ImportResult {
    counts: ImportCounts;
    verdicts: ImportVerdict[];
}

/** An empty tally, to fold verdicts into. */
export function emptyCounts(): ImportCounts {
    return {
        create: 0,
        update: 0,
        skip: 0,
        error: 0,
        assetsNew: 0,
        assetsReused: 0
    };
}

/** Adds one verdict to a tally. */
export function countVerdict(
    counts: ImportCounts,
    verdict: ImportVerdict
): void {
    counts[verdict.action] += 1;
}

/** Whether a set of counts describes a run that would change something. */
export function hasChanges(counts: ImportCounts): boolean {
    return counts.create > 0 || counts.update > 0;
}
