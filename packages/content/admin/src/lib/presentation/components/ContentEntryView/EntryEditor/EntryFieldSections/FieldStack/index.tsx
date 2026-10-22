import { defineMessages, useIntl } from 'react-intl';
import { TriangleAlert } from 'lucide-react';
import type { ContentField } from '../../../../../../domain/types/contentType';
import { fieldWidth, layoutFields } from '../../../../../../domain/fieldLayout';
import type { EntryFormState } from '../../../../../hooks/useEntryForm';
import { useEntryFieldResources } from '../../../../../hooks/useEntryFieldResources';
import { EntryFieldInput } from '../../../../EntryFieldInput';

const messages = defineMessages({
    sharedChanged: {
        id: 'content.form.sharedChanged',
        defaultMessage:
            'Applies to every locale — saving changes it in the other languages too.'
    }
});

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
 * gets a line of its own unless the schema put it beside another — two
 * adjacent half-width fields, or a shared `admin.row` (see `layoutFields`):
 * side by side means "read together", so only the schema may claim it.
 *
 * DOM order is display order either way, so tab order runs left to right
 * across a row and then down.
 */
export function FieldStack({
    fields,
    form,
    isChanged,
    localizedLang,
    sharedLang
}: {
    /** The fields, already in display order. */
    fields: ContentField[];
    form: EntryFormState;
    isChanged?: (name: string) => boolean;
    /**
     * BCP-47 tag put on each **localized** field's cell — for a stack that
     * mixes localized and shared fields (a schema-declared section), where no
     * wrapper can claim one language for the whole run. A shared field gets
     * none: it holds one value for every locale.
     */
    localizedLang?: string;
    /**
     * BCP-47 tag put on each **shared** field's cell — only on a fresh
     * translation prefill, the one moment a shared value's language is known:
     * it was copied verbatim from another locale seconds ago (`ORT-87`).
     */
    sharedLang?: string;
}) {
    const intl = useIntl();
    const resources = useEntryFieldResources();
    const renderField = (field: ContentField) => {
        const lang = field.localized ? localizedLang : sharedLang;
        const changed = isChanged?.(field.name) ?? false;
        // Editing a shared field changes it in every locale. Said under the
        // field the moment it changes — not discovered after the save — and
        // the save itself still confirms through `SiblingSyncDialog` when it
        // reaches a live translation.
        const sharedChanged = resources.i18n && !field.localized && changed;
        return (
            <div
                key={field.name}
                // `min-w-0` lets a grid cell shrink below its content's
                // intrinsic width; `w-fit` shrinks the boolean segments to
                // themselves instead of framing an empty column.
                className={fieldWidth(field) === 'fit' ? 'w-fit' : 'min-w-0'}
                // What the outline scrolls to and watches.
                data-entry-field={field.name}
                {...(lang ? { lang } : {})}
            >
                {/* A relation is drawn by the editor, which owns its staged
                    links; every other field is an ordinary input. */}
                {resources.renderField?.(field) ?? (
                    <EntryFieldInput
                        field={field}
                        value={form.values[field.name]}
                        error={form.errorFor(field.name)}
                        changed={changed}
                        onChange={(value) => form.setValue(field.name, value)}
                        onBlur={() => form.touch(field.name)}
                    />
                )}
                {sharedChanged ? (
                    <p
                        data-testid="entry-field-shared-changed"
                        className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-soft-foreground"
                    >
                        <TriangleAlert
                            aria-hidden
                            className="mt-px size-3.5 shrink-0"
                        />
                        {intl.formatMessage(messages.sharedChanged)}
                    </p>
                ) : null}
            </div>
        );
    };

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
