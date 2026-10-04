import { defineMessages, useIntl } from 'react-intl';
import { SwitchField } from '../../SwitchField';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.rules.structure',
        defaultMessage: 'Structured document'
    },
    hint: {
        id: 'schemaBuilder.rules.structureHint',
        defaultMessage:
            'Stores headings, lists and links as a document rather than HTML.'
    }
});

/** Rich text's `structure: 'on' | 'off'`; off is the default, so off leaves it unset. */
export function StructureRule({
    structure,
    onChange
}: {
    structure?: 'on' | 'off';
    onChange: (patch: Record<string, unknown>) => void;
}) {
    const intl = useIntl();
    return (
        <SwitchField
            id="rule-structure"
            label={intl.formatMessage(messages.label)}
            description={intl.formatMessage(messages.hint)}
            checked={structure === 'on'}
            onChange={(on) => onChange({ structure: on ? 'on' : undefined })}
        />
    );
}
