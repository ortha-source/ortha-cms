import { defineMessages, useIntl } from 'react-intl';
import { SwitchField } from '../../SwitchField';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.rules.structure',
        defaultMessage: 'Check the text’s structure'
    },
    hint: {
        id: 'schemaBuilder.rules.structureHint',
        defaultMessage:
            'On save, headings must not skip a level, tables need headers, links need text and language tags must be valid. Turn off for a body that is not a document — an email template, a pasted HTML fragment.'
    }
});

/**
 * Rich text's `structure: 'on' | 'off'` — whether the kernel checks the body's
 * structure (heading order, table headers, link text, `lang`). **On** is the
 * DSL's default, so on leaves the option unset and only off is written.
 */
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
            checked={structure !== 'off'}
            onChange={(on) => onChange({ structure: on ? undefined : 'off' })}
        />
    );
}
