import type { ContentField } from '../../../../../domain/types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../../../domain/constants';
import type { EntryFormState } from '../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../EntryFieldInput';

/**
 * Field ordering, by control shape. Fields flow top-to-bottom in three tiers
 * by rank:
 *   0 — simple inputs (text, number, money, date, datetime)
 *   1 — choice controls (select, boolean, multi-select)
 *   2 — large fields (rich text, JSON)
 * Types not listed fall to the bottom — a safe default for any new field type.
 */
const FIELD_RANK: Record<string, number> = {
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

const DEFAULT_RANK = 3;

const rankFor = (type: string) => FIELD_RANK[type] ?? DEFAULT_RANK;

/**
 * The General tab body: every editable field in **one** flush block (no card
 * chrome — no border, background, or padding), ordered top-to-bottom by
 * control shape — simple inputs (text, number, dates) first, then choice
 * controls (select, boolean, multi-select), then the large fields (rich text,
 * JSON) last. No section headers: the order alone groups like with like. One
 * field per row — a single stacked column the user works through step by step.
 * Relation fields are handled by their own tab and excluded by the caller.
 */
export function EntryFieldSections({
    fields,
    form,
    isChanged
}: {
    fields: ContentField[];
    form: EntryFormState;
    /** Whether a field has unsaved edits (drives its "Changed" badge). */
    isChanged?: (name: string) => boolean;
}) {
    const ordered = [...fields].sort(
        (a, b) => rankFor(a.type) - rankFor(b.type)
    );

    if (ordered.length === 0) return null;

    return (
        <div className="flex flex-col gap-5">
            {ordered.map((field) => (
                <EntryFieldInput
                    key={field.name}
                    field={field}
                    value={form.values[field.name]}
                    error={form.errorFor(field.name)}
                    changed={isChanged?.(field.name) ?? false}
                    onChange={(value) => form.setValue(field.name, value)}
                    onBlur={() => form.touch(field.name)}
                />
            ))}
        </div>
    );
}
