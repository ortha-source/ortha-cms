import type { IntlShape } from 'react-intl';
import type { FilterField } from '../types/filter-field.type';

/**
 * A field's full display path — `Author · Name` — as one localized string.
 *
 * This is the row's **identity**. With three rules on screen the accessibility
 * tree read, verbatim from a live snapshot:
 *
 * ```
 * combobox "Field"   combobox "Operator"   combobox "Value"   button "Remove rule"
 * combobox "Field"   combobox "Operator"   combobox "Value"   button "Remove rule"
 * combobox "Field"   combobox "Operator"   combobox "Value"   button "Remove rule"
 * ```
 *
 * — nothing distinguished row 2 from row 3, and after activating one of five
 * "Remove rule" buttons there was no way to know which one had gone (4.1.2,
 * 2.4.6 — `ORT-157`). `QueryBuilderSummary` was already composing exactly this
 * string for its chips; it simply was not used inside the builder, which is why
 * it lives here now rather than in either caller.
 *
 * Falls back to the raw `fieldId` for a field that is no longer in the schema —
 * a broken rule still has to be identifiable, and its id is the only handle
 * left.
 */
export function fieldPath(
    intl: IntlShape,
    fields: readonly FilterField[],
    fieldId: string
): string {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (!field) return fieldId;

    const crumbs = (field.group ?? []).map((group) =>
        intl.formatMessage(group)
    );
    return [...crumbs, intl.formatMessage(field.label)].join(' · ');
}
