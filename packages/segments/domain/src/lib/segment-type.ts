/**
 * A **segment type** — one axis of the access decision, and the unit of AND
 * logic. "Organisation", "Plan", "Region" and "Role" are all segment types; the
 * kernel knows none of them by name, only that each owns a tag namespace and
 * that types are AND-ed with one another.
 */

/** A reader's raw entitlement tag, namespaced by its type key: `org:acme`. */
export type SegmentTag = string;

/** The namespace half of a tag — and the key of the type that owns it. */
export type SegmentTypeKey = string;

/**
 * How many segments a type is expected to hold, and therefore how the admin
 * renders it: `low` earns matrix columns, `high` gets a searchable picker. A
 * hint for the UI, never consulted by {@link evaluate}.
 */
export const SEGMENT_CARDINALITY = {
    Low: 'low',
    High: 'high'
} as const;

/** @see SEGMENT_CARDINALITY */
export type SegmentCardinality =
    (typeof SEGMENT_CARDINALITY)[keyof typeof SEGMENT_CARDINALITY];

/**
 * Where a type's segments come from. The kernel does not read any of these —
 * it is the server package that populates segments from the named source — but
 * the vocabulary lives here so both runtimes name the four the same way.
 */
export const SEGMENT_SOURCE_KIND = {
    /** Maintained by hand in the admin (plans, tiers). */
    Manual: 'manual',
    /** A fixed list declared in configuration (regions). */
    Static: 'static',
    /** Mirrors a content collection — one segment per record (organisations). */
    ContentType: 'contentType',
    /** Mirrors an external directory, read through the resolver's adapter. */
    External: 'external'
} as const;

/** @see SEGMENT_SOURCE_KIND */
export type SegmentSourceKind =
    (typeof SEGMENT_SOURCE_KIND)[keyof typeof SEGMENT_SOURCE_KIND];

/**
 * A type's lifecycle. `draining` is the state that makes slot reuse safe: the
 * type has left the predicate and the UI, but its slot columns still hold the
 * old ids and must be zeroed before another type may claim it. Skipping it is
 * how a new type would silently inherit a stranger's segments.
 */
export const SEGMENT_TYPE_STATE = {
    Active: 'active',
    Draining: 'draining',
    Free: 'free'
} as const;

/** @see SEGMENT_TYPE_STATE */
export type SegmentTypeState =
    (typeof SEGMENT_TYPE_STATE)[keyof typeof SEGMENT_TYPE_STATE];

/** Who owns a type's definition — and therefore whether the admin may edit it. */
export const SEGMENT_TYPE_MANAGED_BY = {
    /** Declared in `ortha.config.ts`; read-only in the admin. */
    Config: 'config',
    /** Created in the admin; editable there. */
    Ui: 'ui'
} as const;

/** @see SEGMENT_TYPE_MANAGED_BY */
export type SegmentTypeManagedBy =
    (typeof SEGMENT_TYPE_MANAGED_BY)[keyof typeof SEGMENT_TYPE_MANAGED_BY];

/** One declared axis of the access decision. */
export interface SegmentType {
    /** Stable id. */
    readonly id: string;
    /** Tag namespace this type owns, e.g. `org` for `org:acme`. */
    readonly key: SegmentTypeKey;
    /** Human-readable name, shown in the editor. */
    readonly label: string;
    /** Rendering hint. @see SEGMENT_CARDINALITY */
    readonly cardinality: SegmentCardinality;
    /** Which projection slot pair this type reads and writes. */
    readonly slot: number;
    /** @see SEGMENT_TYPE_STATE */
    readonly state: SegmentTypeState;
    /** @see SEGMENT_TYPE_MANAGED_BY */
    readonly managedBy: SegmentTypeManagedBy;
}

/**
 * The namespace a tag belongs to — everything before the first `:`.
 *
 * A tag with no separator has **no** namespace rather than being its own: a
 * bare `pro` must not be swept up by a mask over some type that happens to be
 * called `pro`, and returning `undefined` is what keeps
 * {@link segmentMatchesTag} from guessing.
 */
export function tagNamespace(tag: SegmentTag): SegmentTypeKey | undefined {
    const at = tag.indexOf(':');
    return at > 0 ? tag.slice(0, at) : undefined;
}
