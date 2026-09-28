import type { ContentField } from '../../../../../../domain/types/contentType';
import { fieldWidth, layoutFields } from '../../../../../../domain/fieldLayout';
import type { EntryFormState } from '../../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../../EntryFieldInput';

/**
 * One line of the form's two-column grid. Collapses to a single column when
 * the form itself (a container query, not the viewport — the sidebar and the
 * Properties panel decide how wide the form is) is too narrow for two.
 * `items-start`: a cell showing a hint or an error is taller than its
 * neighbour, and stretching the neighbour would float its control away from
 * its own label.
 */
const GRID_LINE = 'grid grid-cols-1 items-start gap-5 @lg:grid-cols-2';

/**
 * A run of General-tab fields on a two-column grid.
 *
 * Every field takes a column or the whole line (`fieldWidth`), so the form
 * has exactly two right edges however many field types it mixes. A field
 * still gets a line of its own — a short one simply leaves the other column
 * empty — unless the schema put it on a line with another through
 * `admin.row` (see `layoutFields`): side by side means "read together", so
 * only the schema may claim it.
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
    const renderField = (field: ContentField) => (
        <div
            key={field.name}
            // `min-w-0` lets a grid cell shrink below its content's
            // intrinsic width; `w-fit` shrinks the boolean segments to
            // themselves instead of framing an empty column.
            className={fieldWidth(field) === 'fit' ? 'w-fit' : 'min-w-0'}
        >
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

    return (
        <div className="@container flex flex-col gap-5">
            {layoutFields(fields).map((block) => {
                if (block.kind === 'row') {
                    return (
                        <div
                            key={`row:${block.key}:${block.fields[0].name}`}
                            className={GRID_LINE}
                        >
                            {block.fields.map(renderField)}
                        </div>
                    );
                }
                // A lone half field sits in the first column of an otherwise
                // empty line, so its right edge is the grid's middle.
                return fieldWidth(block.field) === 'half' ? (
                    <div key={block.field.name} className={GRID_LINE}>
                        {renderField(block.field)}
                    </div>
                ) : (
                    renderField(block.field)
                );
            })}
        </div>
    );
}
