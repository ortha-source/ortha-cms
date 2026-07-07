/**
 * Adapts the live content schema + form state into the {@link FieldState} shape
 * the design-system {@link FieldOutline} consumes, so the record editor's left
 * outline is driven by real fields and real validation without duplicating the
 * outline's rendering. Kept separate from the editor component (a plain helper,
 * not a component) so it can be reasoned about on its own.
 */

import type { ContentField } from '../../../types/contentType';
import type { EntryFormState } from '../../../hooks/useEntryForm';
import type { FieldState } from '../../../hooks/useRecordEditor';
import type { FieldDef, FieldType } from '../../../types/recordDraft';
import { CONTENT_FIELD_TYPE } from '../../../constants';
import { fieldLabel } from '../../../utils/entryColumns';

/** Map a content field type onto the outline's field-type vocabulary. Only the
 *  long-form kinds (richtext/json) need to be distinguished — everything else
 *  groups as a scalar in the outline's problems-first mode. */
function toFieldType(type: string): FieldType {
    if (type === CONTENT_FIELD_TYPE.RichText) return 'richtext';
    if (type === CONTENT_FIELD_TYPE.Json) return 'json';
    return 'text';
}

/** Whether a content value counts as filled (drives the outline dot + progress). */
export function isContentFilled(type: string, value: unknown): boolean {
    if (type === CONTENT_FIELD_TYPE.Boolean) return typeof value === 'boolean';
    if (type === CONTENT_FIELD_TYPE.Multiselect)
        return Array.isArray(value) && value.length > 0;
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
}

/**
 * Build the outline's field states from the editor's general (non-relation)
 * fields and the form. `blocking` reuses the form's **strict** errors (required
 * enforced), so the outline's red dots mirror exactly what the publish gate
 * checks.
 */
export function buildOutlineStates(
    fields: ContentField[],
    form: EntryFormState
): FieldState[] {
    return fields.map((field): FieldState => {
        const value = form.values[field.name];
        const def: FieldDef = {
            key: field.name,
            label: fieldLabel(field),
            type: toFieldType(field.type),
            required: field.required
        };
        return {
            field: def,
            value,
            filled: isContentFilled(field.type, value),
            touched: false,
            error: form.errorFor(field.name),
            blocking: !!form.errors[field.name]
        };
    });
}
