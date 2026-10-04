import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
    hint: {
        id: 'schemaBuilder.tab.generalOrder',
        defaultMessage:
            'Above the groups the editor orders fields by control: inputs, then choices, then long text. Inside a group, the declared order is kept.'
    }
});

/** Why the loose fields are not in declaration order — content-domain's table decides. */
export function GeneralOrderHint() {
    const intl = useIntl();
    return (
        <p className="px-4 pb-1 pt-2 text-xs text-muted-foreground">
            {intl.formatMessage(messages.hint)}
        </p>
    );
}
