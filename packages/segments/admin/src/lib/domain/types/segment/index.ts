/**
 * A named set of reader tags (`set`), or the type's wildcard (`mask`) matching
 * every tag in its namespace.
 */
export type SegmentKind = 'set' | 'mask';

/** One segment as the picker and the directory render it. */
export type Segment = {
    /** Stable id — what a rule and a grant point at. */
    id: string;
    /** The owning type's id. */
    typeId: string;
    /** The owning type's key, so a segment can be labelled `org:acme`. */
    typeKey: string;
    /** Key within the type; `*` for the mask. */
    key: string;
    /** Human-readable name. */
    label: string;
    /** Set or mask. */
    kind: SegmentKind;
    /** The reader tags this segment matches — any one of them is enough. */
    tags: readonly string[];
    /** How many projected entries name it — a used segment from a typo. */
    usageCount: number;
};

/**
 * The mask is the type's "any" segment. It is created with the type and deleted
 * with it, so the directory renders it without a delete control and the tag
 * editor refuses it: a mask matches its whole namespace and carries no tags.
 */
export function isMask(segment: Segment): boolean {
    return segment.kind === 'mask';
}

/**
 * Whether a segment can be deleted, and why not.
 *
 * A UX mirror of the server's own refusal (409 while projected entries name
 * it), so the control disables with an explanation instead of failing on
 * click. The server still enforces it — this only saves the round trip.
 */
export function canBeDeleted(
    segment: Segment
): { ok: true } | { ok: false; reason: 'mask' | 'in-use' } {
    if (isMask(segment)) return { ok: false, reason: 'mask' };
    if (segment.usageCount > 0) return { ok: false, reason: 'in-use' };
    return { ok: true };
}
