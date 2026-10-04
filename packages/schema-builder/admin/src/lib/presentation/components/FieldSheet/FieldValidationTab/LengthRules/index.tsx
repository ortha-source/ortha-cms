import { defineMessages, useIntl } from 'react-intl';
import { NumberField } from '../../NumberField';

const messages = defineMessages({
    min: {
        id: 'schemaBuilder.rules.minLength',
        defaultMessage: 'Minimum length'
    },
    max: {
        id: 'schemaBuilder.rules.maxLength',
        defaultMessage: 'Maximum length'
    }
});

type Props = {
    minLength?: number;
    maxLength?: number;
    onChange: (patch: Record<string, unknown>) => void;
};

/** `minLength` / `maxLength` — on rich text they count the text, not the markup. */
export function LengthRules({ minLength, maxLength, onChange }: Props) {
    const intl = useIntl();
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
                id="rule-min-length"
                step={1}
                label={intl.formatMessage(messages.min)}
                value={minLength}
                onChange={(value) => onChange({ minLength: value })}
            />
            <NumberField
                id="rule-max-length"
                step={1}
                label={intl.formatMessage(messages.max)}
                value={maxLength}
                onChange={(value) => onChange({ maxLength: value })}
            />
        </div>
    );
}
