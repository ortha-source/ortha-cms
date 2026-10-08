import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import type { SchemaDocument, TypeDoc } from '@orthacms/schema-builder-domain';
import type { FieldEditor } from '../../../../application/useFieldEditor';
import { SwitchField } from '../SwitchField';
import { DefaultValueField } from './DefaultValueField';
import { RelationSettings } from './RelationSettings';

const messages = defineMessages({
    label: { id: 'schemaBuilder.sheet.label', defaultMessage: 'Label' },
    name: { id: 'schemaBuilder.sheet.name', defaultMessage: 'Machine name' },
    nameHint: {
        id: 'schemaBuilder.sheet.nameHint',
        defaultMessage:
            'Its column. Renaming an existing field is not applied in this version.'
    },
    required: {
        id: 'schemaBuilder.sheet.required',
        defaultMessage: 'Required'
    },
    requiredHint: {
        id: 'schemaBuilder.sheet.requiredHint',
        defaultMessage:
            'On a type with draft & publish, needed to publish; otherwise needed to save.'
    },
    localized: {
        id: 'schemaBuilder.sheet.localized',
        defaultMessage: 'Different in each locale'
    },
    lang: {
        id: 'schemaBuilder.sheet.lang',
        defaultMessage: 'Language of the value'
    },
    langHint: {
        id: 'schemaBuilder.sheet.langHint',
        defaultMessage:
            'A BCP-47 tag, for a value always written in one language.'
    }
});

type Props = {
    editor: FieldEditor;
    type: TypeDoc;
    document: SchemaDocument;
    /** Why the machine name cannot be used — the "Add a field" page checks it as it is typed. */
    nameError?: string;
};

/** Label, name, required, locale, the default — and for a relation, what it links to. */
export function FieldGeneralTab({ editor, type, document, nameError }: Props) {
    const intl = useIntl();
    const { entry } = editor;
    const spec = entry.spec;
    const isRelation = spec.type === 'relation';
    const inverse = isRelation && 'inverseOf' in spec;
    return (
        <div className="flex flex-col gap-4">
            <InputField
                id="field-label"
                label={intl.formatMessage(messages.label)}
                value={spec.admin?.label ?? ''}
                onChange={(event) =>
                    editor.setAdmin({ label: event.target.value })
                }
            />
            <InputField
                id="field-name"
                label={intl.formatMessage(messages.name)}
                description={
                    entry.key.startsWith('new:')
                        ? undefined
                        : intl.formatMessage(messages.nameHint)
                }
                className="font-mono"
                error={nameError}
                value={entry.name}
                onChange={(event) => editor.setName(event.target.value)}
            />
            {!inverse && (
                <SwitchField
                    id="field-required"
                    label={intl.formatMessage(messages.required)}
                    description={intl.formatMessage(messages.requiredHint)}
                    checked={Boolean(spec.required)}
                    onChange={(required) =>
                        editor.setSpec({ required: required || undefined })
                    }
                />
            )}
            {/* A relation says how its links behave per locale in its own settings. */}
            {type.i18n && !isRelation && (
                <SwitchField
                    id="field-localized"
                    label={intl.formatMessage(messages.localized)}
                    checked={Boolean(spec.localized)}
                    onChange={(localized) =>
                        editor.setSpec({ localized: localized || undefined })
                    }
                />
            )}
            {(spec.type === 'text' || spec.type === 'richtext') && (
                <InputField
                    id="field-lang"
                    label={intl.formatMessage(messages.lang)}
                    description={intl.formatMessage(messages.langHint)}
                    className="font-mono"
                    value={spec.lang ?? ''}
                    onChange={(event) =>
                        editor.setSpec({ lang: event.target.value })
                    }
                />
            )}
            <DefaultValueField spec={spec} onChange={editor.setSpec} />
            {spec.type === 'relation' && (
                <RelationSettings
                    spec={spec}
                    type={type}
                    document={document}
                    onChange={editor.setSpec}
                />
            )}
        </div>
    );
}
