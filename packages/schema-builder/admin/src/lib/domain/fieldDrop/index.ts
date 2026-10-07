import type { FieldEntry } from '@orthacms/schema-builder-domain';
import { canMoveField } from '../canMoveField';

/**
 * One list on General a field can be dropped in: the loose fields above the
 * groups (`group: null`) or one group, with its fields in the order drawn.
 */
export type FieldDropList = {
    readonly group: string | null;
    readonly fields: readonly FieldEntry[];
};

/** What a drop does to the draft. */
export type FieldDrop =
    /** Dropped where it started, or nowhere. */
    | { readonly kind: 'none' }
    /** A move the entry editor would undo — across ranks above the groups. */
    | { readonly kind: 'refused' }
    /** A reorder inside its own list: to where `before` is. */
    | { readonly kind: 'move'; readonly before: string }
    /** Into another list: its group changes, and it lands before `before` (or last). */
    | {
          readonly kind: 'regroup';
          readonly group: string | null;
          readonly before: string | null;
      };

/**
 * Decides a drop of `field` from list `from` onto list `to` — on the field
 * `over`, in its upper or lower half (`after`), or on the list itself when it
 * is empty. Inside one list it is a reorder `canMoveField` allows or refuses.
 * Into another list it is always allowed: joining a group, or leaving one for
 * the loose fields, is a change the entry editor shows wherever it lands.
 */
export function fieldDrop(
    field: FieldEntry,
    from: FieldDropList,
    to: FieldDropList,
    over: FieldEntry | null,
    after = false
): FieldDrop {
    if (from.group === to.group) {
        if (!over || over.key === field.key) return { kind: 'none' };
        return canMoveField(field, over)
            ? { kind: 'move', before: over.key }
            : { kind: 'refused' };
    }
    const index = over
        ? to.fields.findIndex((entry) => entry.key === over.key)
        : -1;
    const at = index < 0 ? to.fields.length : index + (after ? 1 : 0);
    return {
        kind: 'regroup',
        group: to.group,
        before: to.fields[at]?.key ?? null
    };
}
