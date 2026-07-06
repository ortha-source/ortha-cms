import type { FieldType } from '../../../types/recordDraft';
import type { FieldControl, FieldControlProps } from './fieldControl';
import { TextControl } from './TextControl';
import { NumberControl } from './NumberControl';
import { DateControl } from './DateControl';
import { BooleanControl } from './BooleanControl';
import { SelectControl } from './SelectControl';
import { MultiSelectControl } from './MultiSelectControl';
import { LongTextControl } from './LongTextControl';

export type { FieldControl, FieldControlProps } from './fieldControl';

/**
 * The field-control registry, keyed by field type. A plugin can register a
 * custom type's control via {@link registerFieldControl}; unknown types fall
 * back to a plain text input, so a schema that outruns the registry still edits.
 */
const FIELD_CONTROLS: Partial<Record<FieldType, FieldControl>> = {
    text: TextControl,
    url: TextControl,
    number: NumberControl,
    money: NumberControl,
    date: DateControl,
    datetime: DateControl,
    boolean: BooleanControl,
    select: SelectControl,
    multiselect: MultiSelectControl,
    richtext: LongTextControl,
    textarea: LongTextControl,
    json: LongTextControl
};

/** Register (or override) the control for a field type. For future plugins. */
export function registerFieldControl(type: FieldType, control: FieldControl) {
    FIELD_CONTROLS[type] = control;
}

/** Renders the registered control for a field, or a text input as a fallback. */
export function FieldRenderer(props: FieldControlProps) {
    const Control = FIELD_CONTROLS[props.field.type] ?? TextControl;
    return <Control {...props} />;
}
