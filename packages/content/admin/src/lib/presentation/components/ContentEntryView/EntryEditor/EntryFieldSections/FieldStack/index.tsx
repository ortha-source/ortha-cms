import type { ContentField } from '../../../../../../domain/types/contentType';
import {
    fieldWidth,
    layoutFields,
    type FieldWidth
} from '../../../../../../domain/fieldLayout';
import type { EntryFormState } from '../../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../../EntryFieldInput';

/**
 * The width a field takes, on a line of its own and inside a row alike — so
 * a number reads the same size wherever it sits. The fixed widths give way
 * (`max-w-full`) on a form narrower than they are; `full` fills its line,
 * and inside a row shares it with its neighbours down to a floor of 16rem;
 * `fit` shrinks to the control, so the boolean segments stop drawing a frame
 * the width of the form around two words.
 */
const WIDTH_CLASS: Record<FieldWidth, string> = {
    narrow: 'w-60 max-w-full',
    medium: 'w-96 max-w-full',
    fit: 'w-fit max-w-full',
    full: 'min-w-64 flex-1'
};

/**
 * A run of General-tab fields, one line per field — except where the schema
 * put fields on a line together with `admin.row` (see `layoutFields`).
 *
 * Every field is drawn at the width its value needs (`fieldWidth`), so a
 * number stops looking like a paragraph. A row is a wrapping flex line: when
 * the form is too narrow for its fields side by side they drop onto the next
 * line on their own, with no breakpoint to tune — which matters because the
 * Properties panel and the sidebar, not the window, decide how wide the form
 * is.
 *
 * DOM order is display order either way, so tab order runs left to right
 * across a row and then down.
 */
export function FieldStack({
    fields,
    form,
    isChanged
}: {
    /** The fields, already in display order. */
    fields: ContentField[];
    form: EntryFormState;
    isChanged?: (name: string) => boolean;
}) {
    const renderField = (field: ContentField, inRow = false) => {
        const width = fieldWidth(field);
        // A lone `full` field is simply the stack's width. `flex-1` belongs to
        // the row's horizontal line only — in the column it would grow the
        // field vertically instead.
        const className =
            width === 'full' && !inRow ? undefined : WIDTH_CLASS[width];
        return (
            <div key={field.name} className={className}>
                <EntryFieldInput
                    field={field}
                    value={form.values[field.name]}
                    error={form.errorFor(field.name)}
                    changed={isChanged?.(field.name) ?? false}
                    onChange={(value) => form.setValue(field.name, value)}
                    onBlur={() => form.touch(field.name)}
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-5">
            {layoutFields(fields).map((block) =>
                block.kind === 'single' ? (
                    renderField(block.field)
                ) : (
                    <div
                        key={`row:${block.key}:${block.fields[0].name}`}
                        // `items-start`: a cell showing a hint or an error is
                        // taller than its neighbour, and stretching the
                        // neighbour to match would float its control away
                        // from its own label.
                        className="flex flex-wrap items-start gap-5"
                    >
                        {block.fields.map((field) => renderField(field, true))}
                    </div>
                )
            )}
        </div>
    );
}
