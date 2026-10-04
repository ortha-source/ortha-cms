import { defineMessages, useIntl } from 'react-intl';
import { SwitchField } from '../../SwitchField';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.rules.integer',
        defaultMessage: 'Whole numbers only'
    }
});

/** A number field's `integer`. */
export function IntegerRule({
    integer,
    onChange
}: {
    integer?: boolean;
    onChange: (patch: Record<string, unknown>) => void;
}) {
    const intl = useIntl();
    return (
        <SwitchField
            id="rule-integer"
            label={intl.formatMessage(messages.label)}
            checked={Boolean(integer)}
            onChange={(on) => onChange({ integer: on || undefined })}
        />
    );
}
