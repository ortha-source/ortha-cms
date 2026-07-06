import { Input } from '@ortha-cms/design-system';
import { asText, type FieldControlProps } from '../fieldControl';

/** Numeric input — `number` (integer, optional sign) and `money` (minor units). */
export function NumberControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    const filter = (raw: string): number | '' => {
        // Money is stored as whole minor units: digits only. A plain number
        // keeps an optional leading sign and a decimal point.
        const cleaned =
            field.type === 'money'
                ? raw.replace(/[^0-9]/g, '')
                : raw.replace(/[^0-9.-]/g, '');
        if (cleaned === '' || cleaned === '-') return '';
        const parsed = Number(cleaned);
        return Number.isNaN(parsed) ? '' : parsed;
    };
    return (
        <Input
            id={inputId}
            inputMode="numeric"
            value={asText(value)}
            placeholder={field.placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={describedById}
            onChange={(event) => onChange(filter(event.target.value))}
            onBlur={onBlur}
        />
    );
}
