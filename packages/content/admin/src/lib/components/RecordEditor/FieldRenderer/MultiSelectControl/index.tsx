import { defineMessages, useIntl } from 'react-intl';
import { MultiSelect } from '@ortha-cms/design-system';
import type { FieldControlProps } from '../fieldControl';

const messages = defineMessages({
    selectPlaceholder: {
        id: 'content.record.selectPlaceholder',
        defaultMessage: 'Select…'
    }
});

/** Chip input (selected badges + an add popover) for a `multiselect`. */
export function MultiSelectControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    const intl = useIntl();
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
        <MultiSelect
            id={inputId}
            options={(field.options ?? []).map((option) => ({
                value: option,
                label: option
            }))}
            value={selected}
            onChange={(next) => {
                onChange(next);
                onBlur();
            }}
            invalid={invalid}
            aria-describedby={describedById}
            placeholder={intl.formatMessage(messages.selectPlaceholder)}
        />
    );
}
