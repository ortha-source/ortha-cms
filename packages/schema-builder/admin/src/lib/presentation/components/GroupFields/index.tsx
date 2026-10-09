import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import { SwitchField } from '../FieldSheet/SwitchField';

const messages = defineMessages({
    label: { id: 'schemaBuilder.groups.label', defaultMessage: 'Title' },
    description: {
        id: 'schemaBuilder.groups.description',
        defaultMessage: 'Description'
    },
    collapsed: {
        id: 'schemaBuilder.groups.collapsed',
        defaultMessage: 'Starts folded'
    }
});

type Props = { group: GroupDoc; onChange: (group: GroupDoc) => void };

/**
 * What a group says about itself — title, description, folded or not. The
 * same inputs in the groups sheet and in one group's own sheet.
 */
export function GroupFields({ group, onChange }: Props) {
    const intl = useIntl();
    const id = `group-${group.key}`;
    return (
        <>
            <InputField
                id={`${id}-label`}
                label={intl.formatMessage(messages.label)}
                value={group.label}
                onChange={(event) =>
                    onChange({ ...group, label: event.target.value })
                }
            />
            <InputField
                id={`${id}-description`}
                label={intl.formatMessage(messages.description)}
                value={group.description ?? ''}
                onChange={(event) =>
                    onChange({
                        ...group,
                        description: event.target.value || undefined
                    })
                }
            />
            <SwitchField
                id={`${id}-collapsed`}
                label={intl.formatMessage(messages.collapsed)}
                checked={Boolean(group.collapsed)}
                onChange={(collapsed) =>
                    onChange({ ...group, collapsed: collapsed || undefined })
                }
            />
        </>
    );
}
