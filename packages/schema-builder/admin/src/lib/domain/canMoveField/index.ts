import { generalTabRank } from '@orthacms/content-domain';
import type { FieldEntry } from '@orthacms/schema-builder-domain';

/**
 * Whether dropping `field` where `target` is changes anything the entry
 * editor shows. Inside one group the declared order holds, so any move in it
 * counts. Above the groups the editor re-sorts by rank, so a move across ranks
 * would look accepted and then do nothing — the list refuses it instead.
 */
export function canMoveField(field: FieldEntry, target: FieldEntry): boolean {
    const group = field.spec.admin?.group;
    if (group !== target.spec.admin?.group) return false;
    if (group) return true;
    return generalTabRank(field.spec.type) === generalTabRank(target.spec.type);
}
