import { Input } from '@ortha-cms/design-system';
import { asText, type FieldControlProps } from '../fieldControl';

/** Plain single-line input — `text` and `url` (URL adds the `https://` hint). */
export function TextControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    return (
        <Input
            id={inputId}
            type={field.type === 'url' ? 'url' : 'text'}
            value={asText(value)}
            placeholder={
                field.placeholder ??
                (field.type === 'url' ? 'https://' : undefined)
            }
            aria-invalid={invalid || undefined}
            aria-describedby={describedById}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
        />
    );
}
