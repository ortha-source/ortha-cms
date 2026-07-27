import type { AnyContentType } from '../../../types/content-type';
import { toRecord } from '../../../entries/infrastructure/persistence/entry-row';
import type { RevisionSnapshot } from '../../types/revision-view';

/** A generated content row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/**
 * Build the immutable snapshot for a just-saved entry: its field `values` (the
 * same bag the reader serves and the editor submits — scalars, localized +
 * shared fields, and single-relation FK ids) plus the ordered target-id list of
 * each join-backed relation field (owning many-to-many and the inverse of one).
 *
 * `relations` is read separately from the join tables — those links never travel
 * in the `values` bag — inside the save transaction, so the snapshot reflects
 * exactly what committed.
 */
export function buildSnapshot(
    type: AnyContentType,
    row: Row,
    relations: Record<string, string[]>
): RevisionSnapshot {
    return {
        values: toRecord(type, row).values,
        relations
    };
}
