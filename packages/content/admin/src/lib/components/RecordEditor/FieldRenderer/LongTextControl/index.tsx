import { defineMessages, useIntl } from 'react-intl';
import { Textarea } from '@ortha-cms/design-system';
import { asText, type FieldControlProps } from '../fieldControl';

const messages = defineMessages({
    jsonPlaceholder: {
        id: 'content.record.jsonPlaceholder',
        defaultMessage: '{ "key": "value" }'
    }
});

/** Multi-line textarea — `richtext` (tall), `textarea`, and `json` (mono). */
export function LongTextControl({
    field,
    value,
    invalid,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    const intl = useIntl();
    const isJson = field.type === 'json';
    return (
        <Textarea
            id={inputId}
            value={asText(value)}
            placeholder={
                isJson
                    ? intl.formatMessage(messages.jsonPlaceholder)
                    : field.placeholder
            }
            aria-invalid={invalid || undefined}
            aria-describedby={describedById}
            spellCheck={!isJson}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            className={
                isJson
                    ? 'min-h-[90px] font-mono text-[13px]'
                    : field.type === 'richtext'
                      ? 'min-h-[150px]'
                      : 'min-h-[90px]'
            }
        />
    );
}
