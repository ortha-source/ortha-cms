import { defineMessages, useIntl } from 'react-intl';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import type { FilterField } from '../../../../../types/filter-field.type';

const messages = defineMessages({
    label: { id: 'qb.field.label', defaultMessage: 'Field' }
});

/** Props for {@link FieldPicker}. */
export type FieldPickerProps = {
    fields: readonly FilterField[];
    value: string;
    onChange: (next: string) => void;
};

/** Dropdown selector over the consumer-declared filter fields. */
export function FieldPicker({ fields, value, onChange }: FieldPickerProps) {
    const intl = useIntl();
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger
                className="w-40"
                aria-label={intl.formatMessage(messages.label)}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {fields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                        {intl.formatMessage(f.label)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
