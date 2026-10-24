import type { ProposalChange, ProposalDraft } from './proposal';

/**
 * How many field changes a permission prompt carries at most.
 *
 * The prompt shows three records and a "Show all", so this is a ceiling on the
 * frame rather than on what anyone reads: a batch is capped by its own tool
 * (`BULK_MAX_SAVE_ITEMS`), but one record with a large rich-text body times
 * fifty would still be a frame nobody needs in full to decide. Past it the
 * preview says how many it left out.
 */
export const MAX_PREVIEW_CHANGES = 100;

/**
 * What a write **would** do, shown on the permission prompt before anything has
 * run.
 *
 * The prompt used to show the call's raw arguments as JSON — accurate, and
 * unreadable at the one moment a person has to decide whether a write may
 * happen. A `propose` tool is a pure function of its arguments and the current
 * record (it computes a draft and writes nothing; the engine applies it), so
 * the engine can run it **before** asking and hand the person the same
 * before/after diff the receipt will show afterwards — "Was → Now", marked
 * *Not saved*.
 *
 * It is a picture, never a commitment. Allowing the call runs the tool again
 * against whatever the records hold by then, and that second draft is what is
 * recorded and applied; the receipt card is the authority on what happened.
 */
export interface PermissionPreview {
    /** The applier the change is for, e.g. `content.entry.bulk-save`. */
    kind: string;
    /** The tool's one line for a person — the card's title. */
    summary: string;
    /** Whether it would land as a draft or go live; absent when unknown. */
    lands?: 'draft' | 'live';
    /** How many distinct records the change touches. */
    records: number;
    /** The field changes, at most {@link MAX_PREVIEW_CHANGES} of them. */
    changes: ProposalChange[];
    /** How many changes were left out of {@link changes} by the cap. */
    omitted: number;
}

/**
 * Which record a change belongs to, for counting and grouping.
 *
 * The binder's own `record` when it named one; otherwise the batch position a
 * bulk tool prefixes its field with (`items[3].title` → `items[3]`), so a batch
 * from a binder that predates `record` still counts as N records and not as one
 * per field; otherwise the whole change is one record.
 */
export function changeRecordKey(change: ProposalChange): string {
    if (change.record) return `record:${change.record}`;
    const position = /^(items\[\d+\])\./.exec(change.field);
    return position ? position[1] : 'single';
}

/** The number of distinct records a list of changes touches — never below one. */
export function countRecords(changes: readonly ProposalChange[]): number {
    return Math.max(1, new Set(changes.map(changeRecordKey)).size);
}

/**
 * Builds the preview a permission prompt carries from a `propose` tool's draft.
 *
 * Pure, so the cap and the record count are unit tests rather than a run.
 */
export function permissionPreview(
    draft: ProposalDraft,
    limit = MAX_PREVIEW_CHANGES
): PermissionPreview {
    const all = draft.changes ?? [];
    const changes = all.slice(0, Math.max(0, limit));
    return {
        kind: draft.kind,
        summary: draft.summary,
        ...(draft.lands ? { lands: draft.lands } : {}),
        records: countRecords(all),
        changes,
        omitted: all.length - changes.length
    };
}
