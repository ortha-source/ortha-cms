import type { SegmentResolver, SegmentType } from '@orthacms/segments-domain';

/**
 * A segment type declared in `ortha.config.ts` rather than created in the
 * admin.
 *
 * Config-declared types are what makes a generated app reproducible from its
 * checkout: the axes its content is segmented on are code, reviewed like code.
 * They arrive in the same catalogue as admin-created ones and are marked
 * read-only there — an operator may add a type, never redefine one the app
 * declared.
 */
export interface DeclaredSegmentType {
    /** Tag namespace, e.g. `plan` for `plan:pro`. */
    readonly key: string;
    /** Human-readable name shown in the editor. */
    readonly label: string;
    /** Rendering hint. Defaults to `low`. */
    readonly cardinality?: SegmentType['cardinality'];
}

/** Configuration for `SegmentsPlugin`. */
export interface SegmentsPluginConfig {
    /**
     * Where a reader's tags come from.
     *
     * Absent means every reader is anonymous — unrestricted content is served
     * and nothing else. That is the honest default: the CMS does not own
     * subscriptions or org charts, and inventing an answer would be worse than
     * declining to have one.
     */
    readonly resolver?: SegmentResolver<unknown>;
    /**
     * Segment types the app declares in code. Reconciled into the catalogue at
     * boot: a declared type that is missing is created, one that exists is
     * updated in place, and one that was removed from the config is left alone
     * rather than deleted — dropping a type silently unrestricts whatever it
     * was hiding.
     */
    readonly types?: readonly DeclaredSegmentType[];
}
