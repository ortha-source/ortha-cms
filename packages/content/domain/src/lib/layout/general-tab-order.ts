import { CONTENT_FIELD_TYPE } from '../fields/field-type';

/**
 * How the entry editor orders the fields that sit above every group on the
 * General tab, top to bottom: simple inputs, then choice controls, then large
 * fields. A type not listed falls to the bottom — a safe default for a new one.
 * Inside a group the author's declaration order is kept instead.
 *
 * Shared by content-admin, which draws the form, and the schema builder, which
 * shows where a field will land — so the two can never disagree.
 */
export const GENERAL_TAB_RANK: Readonly<Record<string, number>> = {
    [CONTENT_FIELD_TYPE.Text]: 0,
    [CONTENT_FIELD_TYPE.Number]: 0,
    [CONTENT_FIELD_TYPE.Money]: 0,
    [CONTENT_FIELD_TYPE.Date]: 0,
    [CONTENT_FIELD_TYPE.Datetime]: 0,
    [CONTENT_FIELD_TYPE.Select]: 1,
    [CONTENT_FIELD_TYPE.Boolean]: 1,
    [CONTENT_FIELD_TYPE.Multiselect]: 1,
    [CONTENT_FIELD_TYPE.RichText]: 2,
    [CONTENT_FIELD_TYPE.Json]: 2
};

/** The rank of a type with no entry above: after every listed one. */
export const GENERAL_TAB_DEFAULT_RANK = 3;

export const generalTabRank = (type: string): number =>
    GENERAL_TAB_RANK[type] ?? GENERAL_TAB_DEFAULT_RANK;

/** Stable: within one rank, declaration order holds. */
export function orderGeneralTab<T extends { type: string }>(
    fields: readonly T[]
): T[] {
    return [...fields].sort(
        (a, b) => generalTabRank(a.type) - generalTabRank(b.type)
    );
}
