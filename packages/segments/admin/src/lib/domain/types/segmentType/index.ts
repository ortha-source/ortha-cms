/** How a type's segments are rendered: a matrix column, or a searchable picker. */
export type SegmentCardinality = 'low' | 'high';

/**
 * Where a type is in the slot lifecycle. Only `active` takes part in the access
 * decision; `draining` is mid-retirement and `free` has handed its slot back.
 */
export type SegmentTypeState = 'active' | 'draining' | 'free';

/** Who owns the type's definition — `ortha.config.ts`, or this UI. */
export type SegmentTypeManagedBy = 'config' | 'ui';

/**
 * One axis reader access is decided on — the tag namespace before the colon in
 * `org:acme`, and the projection slot it claims.
 */
export type SegmentType = {
    /** Stable id (the rename/retire handle). */
    id: string;
    /** The tag namespace this type owns. Immutable. */
    key: string;
    /** Human-readable name, shown in the entry editor. */
    label: string;
    /** Rendering hint for the picker. */
    cardinality: SegmentCardinality;
    /** Which `allow_dN`/`deny_dN` pair the projection writes for this type. */
    slot: number;
    /** Where the type is in the retirement lifecycle. */
    state: SegmentTypeState;
    /** `config` types are read-only here — they are declared in the app's config. */
    managedBy: SegmentTypeManagedBy;
    /** How many segments the type holds, its mask included. */
    segmentCount: number;
};

/** A type declared in configuration cannot be renamed or retired from the UI. */
export function isEditable(type: SegmentType): boolean {
    return type.managedBy === 'ui';
}

/** Only an `active` type takes part in the access decision. */
export function isEnforced(type: SegmentType): boolean {
    return type.state === 'active';
}
