/**
 * A **segment** — a named set of tags within one segment type, and the unit
 * both a rule and a grant point at.
 *
 * Segments exist so that rules do not point at raw tags. A plan renamed in the
 * billing system, an organisation that gains a second identifier, a tier merged
 * into another — all of those change a segment's `tags` and leave every rule,
 * every grant and every projected row untouched. That indirection is the whole
 * reason for this file.
 */

import {
    tagNamespace,
    type SegmentTag,
    type SegmentTypeKey
} from './segment-type';

/**
 * What a segment matches.
 *
 * A `mask` matches **any** tag in its type's namespace, which is what makes
 * "every organisation, except these three" expressible as a deny of three
 * rather than an allow of 397 — see the exclusion invariant in
 * {@link evaluate}. Onboarding a new organisation then rewrites nothing.
 */
export const SEGMENT_KIND = {
    /** Matches a caller carrying any of the segment's own `tags`. */
    Set: 'set',
    /** Matches a caller carrying any tag in the type's namespace. */
    Mask: 'mask'
} as const;

/** @see SEGMENT_KIND */
export type SegmentKind = (typeof SEGMENT_KIND)[keyof typeof SEGMENT_KIND];

/** A named set of tags inside one segment type. */
export interface Segment {
    /** Stable id — what a rule, a grant and a projected row store. */
    readonly id: string;
    /** The type this segment belongs to. */
    readonly typeKey: SegmentTypeKey;
    /** Key within the type, e.g. `acme` (the tag is `org:acme`). */
    readonly key: string;
    /** Human-readable name. */
    readonly label: string;
    /** @see SEGMENT_KIND */
    readonly kind: SegmentKind;
    /**
     * The tags a `set` segment matches. Any one of them is enough — a segment
     * is a union, never an intersection, so a plan can carry both its current
     * and its legacy identifier without splitting into two segments.
     *
     * Ignored for a `mask`, whose membership is decided by the namespace.
     */
    readonly tags: readonly SegmentTag[];
}

/** Whether one segment matches one tag. */
export function segmentMatchesTag(segment: Segment, tag: SegmentTag): boolean {
    return segment.kind === SEGMENT_KIND.Mask
        ? tagNamespace(tag) === segment.typeKey
        : segment.tags.includes(tag);
}

/**
 * Resolve a caller's raw tags into the set of segment ids they fall into.
 *
 * This runs **once per request, in code** — which is precisely why masks cost
 * nothing on the hot path: prefix matching happens here, and the SQL predicate
 * only ever intersects two arrays of ids.
 */
export function segmentIdsForTags(
    segments: readonly Segment[],
    tags: Iterable<SegmentTag>
): ReadonlySet<string> {
    const wanted = tags instanceof Set ? tags : new Set(tags);
    const out = new Set<string>();
    if (!wanted.size) {
        return out;
    }
    for (const segment of segments) {
        for (const tag of wanted) {
            if (segmentMatchesTag(segment, tag)) {
                out.add(segment.id);
                break;
            }
        }
    }
    return out;
}

/**
 * The caller's resolved segments, grouped by type.
 *
 * The grouped view is what the SQL compiler needs: one array of ids per type,
 * because each type contributes its own pair of conditions against its own slot
 * columns. Types the caller has nothing in are simply absent — an absent type
 * is not an empty one, and the compiler treats them the same way only because
 * an empty intersection is what both mean.
 */
export function groupSegmentIdsByType(
    segments: readonly Segment[],
    segmentIds: ReadonlySet<string>
): ReadonlyMap<SegmentTypeKey, readonly string[]> {
    const out = new Map<SegmentTypeKey, string[]>();
    for (const segment of segments) {
        if (!segmentIds.has(segment.id)) continue;
        const bucket = out.get(segment.typeKey);
        if (bucket) bucket.push(segment.id);
        else out.set(segment.typeKey, [segment.id]);
    }
    return out;
}
