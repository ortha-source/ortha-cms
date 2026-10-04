import { defineMessages, useIntl } from 'react-intl';
import { NumberField } from '../../NumberField';

const messages = defineMessages({
    min: { id: 'schemaBuilder.rules.min', defaultMessage: 'Minimum' },
    max: { id: 'schemaBuilder.rules.max', defaultMessage: 'Maximum' }
});

type Props = {
    min?: number;
    max?: number;
    onChange: (patch: Record<string, unknown>) => void;
};

/** `min` / `max` — on money, in minor units, as the column stores them. */
export function RangeRules({ min, max, onChange }: Props) {
    const intl = useIntl();
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
                id="rule-min"
                label={intl.formatMessage(messages.min)}
                value={min}
                onChange={(value) => onChange({ min: value })}
            />
            <NumberField
                id="rule-max"
                label={intl.formatMessage(messages.max)}
                value={max}
                onChange={(value) => onChange({ max: value })}
            />
        </div>
    );
}
