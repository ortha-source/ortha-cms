/**
 * The ceilings segmentation runs under.
 *
 * Both are cost limits with a visible failure mode, not arbitrary round
 * numbers, and both are stated here so the server's validation and the admin's
 * "2 of 8" counter read the same constant.
 */

/**
 * Condition groups per rule.
 *
 * Each group is one row of the entry's projection, so a group added at type
 * level multiplies the projection for every entry of that type. Eight is the
 * point past which "add another OR" stops being a cheap edit; the number is a
 * starting position to be revisited against a real write benchmark, not a
 * measured optimum.
 */
export const MAX_CONDITION_GROUPS = 8;

/**
 * Segment types active at once.
 *
 * Bounded by the projection's slot columns — a type claims one `allow`/`deny`
 * pair, and the pairs are created by migration rather than by runtime DDL, so
 * the schema stays reproducible from a checkout. Raising it is one migration
 * that adds the next batch.
 */
export const MAX_SEGMENT_TYPES = 8;
