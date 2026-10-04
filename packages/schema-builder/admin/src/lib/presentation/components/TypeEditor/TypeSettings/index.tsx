import { defineMessages, useIntl } from 'react-intl';
import { Badge, InputField } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import type { TypePatch } from '../../../../domain/schemaDraftAction';
import { OriginBadge } from '../../OriginBadge';
import { FlagSwitch } from './FlagSwitch';

const messages = defineMessages({
    collection: {
        id: 'schemaBuilder.type.collection',
        defaultMessage: 'collection'
    },
    single: { id: 'schemaBuilder.type.single', defaultMessage: 'page' },
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
    path: { id: 'schemaBuilder.type.path', defaultMessage: 'Path' },
    pathHint: {
        id: 'schemaBuilder.settings.pathHint',
        defaultMessage: 'Where the page lives on the site, starting with /.'
    }
});

type Props = { type: TypeDoc; onChange: (patch: TypePatch) => void };

/** A type's own options as a form; every control is one option of `collection()` / `single()`. */
export function TypeSettings({ type, onChange }: Props) {
    const intl = useIntl();
    const isNew = type.origin === 'new';
    return (
        <section
            aria-labelledby="schema-type-title"
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
        >
            <div className="flex flex-wrap items-center gap-2">
                <h2 id="schema-type-title" className="text-lg font-semibold">
                    {type.label || type.name}
                </h2>
                <Badge variant="outline" className="font-normal">
                    {intl.formatMessage(messages[type.kind])}
                </Badge>
                <OriginBadge origin={type.origin} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
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
                <InputField
                    id="type-description"
                    label={intl.formatMessage(messages.description)}
                    value={type.description ?? ''}
                    onChange={(event) =>
                        onChange({
                            description: event.target.value || undefined
                        })
                    }
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
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
                {(['publishable', 'paranoid', 'i18n'] as const).map((flag) => (
                    <FlagSwitch
                        key={flag}
                        type={type}
                        flag={flag}
                        onChange={(value) => onChange({ [flag]: value })}
                    />
                ))}
            </div>
        </section>
    );
}
