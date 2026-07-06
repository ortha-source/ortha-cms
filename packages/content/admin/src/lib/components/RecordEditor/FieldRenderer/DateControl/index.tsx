import { asText, type FieldControlProps } from '../fieldControl';
import { DateField } from '../../../EntryFieldInput/DateField';

/** `date` / `datetime` — reuses the shared design-system date picker adapter. */
export function DateControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    return (
        <DateField
            id={inputId}
            value={asText(value)}
            withTime={field.type === 'datetime'}
            invalid={invalid}
            aria-describedby={describedById}
            onChange={onChange}
            onBlur={onBlur}
        />
    );
}
