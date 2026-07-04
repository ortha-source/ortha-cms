import type { ContentField } from '../../../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../../constants';
import type { EntryFormState } from '../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../EntryFieldInput';
import { ChangedBadge } from '../../../ChangedBadge';

/**
 * Field ordering and layout, by control shape. Fields flow top-to-bottom in
 * three tiers by `rank`:
 *   0 — simple inputs (text, number, money, date, datetime)
 *   1 — choice controls (select, boolean, multi-select)
 *   2 — large fields (rich text, JSON)
 * Everything but the large fields shares a two-column grid; large fields span
 * the full row (`full`). Types not listed fall to the bottom as full-width — a
 * safe default for any new field type.
 */
const FIELD_LAYOUT: Record<string, { rank: number; full: boolean }> = {
    [CONTENT_FIELD_TYPE.Text]: { rank: 0, full: false },
    [CONTENT_FIELD_TYPE.Number]: { rank: 0, full: false },
    [CONTENT_FIELD_TYPE.Money]: { rank: 0, full: false },
    [CONTENT_FIELD_TYPE.Date]: { rank: 0, full: false },
    [CONTENT_FIELD_TYPE.Datetime]: { rank: 0, full: false },
    [CONTENT_FIELD_TYPE.Select]: { rank: 1, full: false },
    [CONTENT_FIELD_TYPE.Boolean]: { rank: 1, full: false },
    [CONTENT_FIELD_TYPE.Multiselect]: { rank: 1, full: false },
    [CONTENT_FIELD_TYPE.RichText]: { rank: 2, full: true },
    [CONTENT_FIELD_TYPE.Json]: { rank: 2, full: true }
};

const DEFAULT_LAYOUT = { rank: 3, full: true };

const layoutFor = (type: string) => FIELD_LAYOUT[type] ?? DEFAULT_LAYOUT;

/**
 * The General tab body: every editable field in **one** flush block (no card
 * chrome — no border, background, or padding), ordered top-to-
 * bottom by control shape — simple inputs (text, number, dates) first, then
 * choice controls (select, boolean, multi-select), then the large fields (rich
 * text, JSON) last. No section headers: the order alone groups like with like.
 * The layout is a single CSS grid — compact controls pack two-up, large fields
 * break to their own full-width row (`sm:col-span-2`).
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
        (a, b) => layoutFor(a.type).rank - layoutFor(b.type).rank
    );

    if (ordered.length === 0) return null;

    return (
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {ordered.map((field) => (
                <div
                    key={field.name}
                    className={`relative ${
                        layoutFor(field.type).full ? 'sm:col-span-2' : ''
                    }`}
                >
                    {isChanged?.(field.name) ? (
                        <div className="pointer-events-none absolute right-0 top-0">
                            <ChangedBadge />
                        </div>
                    ) : null}
                    <EntryFieldInput
                        field={field}
                        value={form.values[field.name]}
                        error={form.errorFor(field.name)}
                        onChange={(value) => form.setValue(field.name, value)}
                        onBlur={() => form.touch(field.name)}
                    />
                </div>
            ))}
        </div>
    );
}
