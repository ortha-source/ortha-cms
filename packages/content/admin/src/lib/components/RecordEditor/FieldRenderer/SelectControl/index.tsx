import { defineMessages, useIntl } from 'react-intl';
import { Check } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import { asText, type FieldControlProps } from '../fieldControl';

const messages = defineMessages({
    selectPlaceholder: {
        id: 'content.record.selectPlaceholder',
        defaultMessage: 'Select…'
    }
});

/** Single-choice popover listbox for a `select`. */
export function SelectControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    const intl = useIntl();
    return (
        <Select
            value={asText(value) || undefined}
            onValueChange={(next) => {
                onChange(next);
                onBlur();
            }}
        >
            <SelectTrigger
                id={inputId}
                aria-invalid={invalid || undefined}
                aria-describedby={describedById}
                className="h-9 w-full rounded-lg"
            >
                <SelectValue
                    placeholder={intl.formatMessage(messages.selectPlaceholder)}
                />
            </SelectTrigger>
            <SelectContent>
                {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                        <span className="flex w-full items-center justify-between gap-2">
                            {option}
                            {value === option ? (
                                <Check className="size-4" aria-hidden />
                            ) : null}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
