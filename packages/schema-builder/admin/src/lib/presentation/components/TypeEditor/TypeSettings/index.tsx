import { defineMessages, useIntl } from 'react-intl';
import { InputField, Label, Textarea } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import type { TypePatch } from '../../../../domain/schemaDraftAction';
import { FlagSwitch } from './FlagSwitch';

const messages = defineMessages({
    label: { id: 'schemaBuilder.settings.label', defaultMessage: 'Label' },
    name: { id: 'schemaBuilder.type.name', defaultMessage: 'Machine name' },
    nameFixed: {
        id: 'schemaBuilder.settings.nameFixed',
        defaultMessage: 'Fixed once the type exists — it names the table.'
    },
    nameNew: {
        id: 'schemaBuilder.settings.nameNew',
        defaultMessage:
            'Lowercase letters, digits and underscores. Fixed once applied.'
    },
    description: {
        id: 'schemaBuilder.type.description',
        defaultMessage: 'Description'
    },
    descriptionPlaceholder: {
        id: 'schemaBuilder.type.descriptionPlaceholder',
        defaultMessage:
            'What this type is for — shown to the people who edit it.'
    },
    path: { id: 'schemaBuilder.type.path', defaultMessage: 'Path' },
    pathHint: {
        id: 'schemaBuilder.settings.pathHint',
        defaultMessage: 'Where the page lives on the site, starting with /.'
    },
    storage: {
        id: 'schemaBuilder.settings.storage',
        defaultMessage: 'Features'
    }
});

type Props = {
    type: TypeDoc;
    /** The type as served, when it exists there — what a flag is judged against. */
    served: TypeDoc | undefined;
    onChange: (patch: TypePatch) => void;
};

/**
 * A type's own options as a form — the body of its Settings sheet; every
 * control is one option of `collection()` / `single()`.
 */
export function TypeSettings({ type, served, onChange }: Props) {
    const intl = useIntl();
    const isNew = type.origin === 'new';
    return (
        <div className="flex flex-col gap-5">
            <InputField
                id="type-label"
                label={intl.formatMessage(messages.label)}
                value={type.label ?? ''}
                onChange={(event) =>
                    onChange({ label: event.target.value || undefined })
                }
            />
            <InputField
                id="type-name"
                label={intl.formatMessage(messages.name)}
                description={intl.formatMessage(
                    isNew ? messages.nameNew : messages.nameFixed
                )}
                className="font-mono"
                value={type.name}
                disabled={!isNew}
                onChange={(event) => onChange({ name: event.target.value })}
            />
            {type.kind === 'single' && (
                <InputField
                    id="type-path"
                    label={intl.formatMessage(messages.path)}
                    description={intl.formatMessage(messages.pathHint)}
                    className="font-mono"
                    value={type.path ?? ''}
                    onChange={(event) =>
                        onChange({ path: event.target.value || undefined })
                    }
                />
            )}
            <div className="flex flex-col gap-2">
                <Label htmlFor="type-description">
                    {intl.formatMessage(messages.description)}
                </Label>
                <Textarea
                    id="type-description"
                    rows={3}
                    className="min-h-0 resize-y"
                    placeholder={intl.formatMessage(
                        messages.descriptionPlaceholder
                    )}
                    value={type.description ?? ''}
                    onChange={(event) =>
                        onChange({
                            description: event.target.value || undefined
                        })
                    }
                />
            </div>
            <fieldset className="flex flex-col gap-4 border-t pt-5">
                <legend className="float-left mb-1 text-sm font-medium">
                    {intl.formatMessage(messages.storage)}
                </legend>
                {(['publishable', 'paranoid', 'i18n'] as const).map((flag) => (
                    <FlagSwitch
                        key={flag}
                        type={type}
                        served={served}
                        flag={flag}
                        onChange={(value) => onChange({ [flag]: value })}
                    />
                ))}
            </fieldset>
        </div>
    );
}
