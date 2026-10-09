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
 * Decides a drop of `field` from list `from` onto list `to`, on the field
 * `over` — or on nothing, an empty list's own drop zone included.
 *
 * Inside one list it is a reorder `canMoveField` allows or refuses. Into
 * another list it is always allowed: joining a group, or leaving one for the
 * loose fields, is a change the entry editor shows wherever it lands. `to` is
 * the list as the drag drew it, so it may already hold the field — moved
 * there while it was dragged over — and the field then lands where `over` is,
 * the way a reorder does. Not yet in it, the field goes before `over`, or
 * last.
 */
export function fieldDrop(
    field: FieldEntry,
    from: FieldDropList,
    to: FieldDropList,
    over: FieldEntry | null
): FieldDrop {
    if (from.group === to.group) {
        if (!over || over.key === field.key) return { kind: 'none' };
        return canMoveField(field, over)
            ? { kind: 'move', before: over.key }
            : { kind: 'refused' };
    }
    const keys = to.fields
        .map((entry) => entry.key)
        .filter((key) => key !== field.key);
    const target = over ? keys.indexOf(over.key) : -1;
    const drawn = to.fields.findIndex((entry) => entry.key === field.key);
    let at: number;
    if (target < 0) {
        // On itself, or on no field: where the drag drew it, else last.
        at = drawn < 0 ? keys.length : drawn;
    } else {
        // Where `over` is — after it when the field was drawn above it.
        at = drawn >= 0 && drawn <= target ? target + 1 : target;
    }
    return { kind: 'regroup', group: to.group, before: keys[at] ?? null };
}
