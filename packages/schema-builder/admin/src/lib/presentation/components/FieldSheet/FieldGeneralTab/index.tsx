import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import type { SchemaDocument, TypeDoc } from '@orthacms/schema-builder-domain';
import type { FieldEditor } from '../../../../application/useFieldEditor';
import { SwitchField } from '../SwitchField';
import { DefaultValueField } from './DefaultValueField';
import { RelationSettings } from './RelationSettings';
import { SelectOptionsEditor } from './SelectOptionsEditor';

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
    localizedOn: {
        id: 'schemaBuilder.sheet.localizedOn',
        defaultMessage: 'On: each language has its own value.'
    },
    localizedOff: {
        id: 'schemaBuilder.sheet.localizedOff',
        defaultMessage: 'Off: one value shared by every language.'
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
    /** Puts the cursor in the label — a field being added starts there. */
    autoFocusLabel?: boolean;
};

/**
 * Label, name, required, locale, a select's options, the default — and for a
 * relation, what it links to. The options come before the default because the
 * default is picked from them.
 */
export function FieldGeneralTab({
    editor,
    type,
    document,
    nameError,
    autoFocusLabel
}: Props) {
    const intl = useIntl();
    const { entry } = editor;
    const spec = entry.spec;
    const isRelation = spec.type === 'relation';
    const inverse = isRelation && 'inverseOf' in spec;
    const isNew = entry.key.startsWith('new:');
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <div className="grid gap-3 sm:grid-cols-2">
                    <InputField
                        id="field-label"
                        label={intl.formatMessage(messages.label)}
                        value={spec.admin?.label ?? ''}
                        autoFocus={autoFocusLabel}
                        onChange={(event) =>
                            editor.setAdmin({ label: event.target.value })
                        }
                    />
                    <InputField
                        id="field-name"
                        label={intl.formatMessage(messages.name)}
                        className="font-mono"
                        error={nameError}
                        aria-describedby={isNew ? undefined : 'field-name-hint'}
                        value={entry.name}
                        onChange={(event) => editor.setName(event.target.value)}
                    />
                </div>
                {!isNew && (
                    <p
                        id="field-name-hint"
                        className="text-xs text-muted-foreground"
                    >
                        {intl.formatMessage(messages.nameHint)}
                    </p>
                )}
            </div>
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
                    description={intl.formatMessage(
                        spec.localized
                            ? messages.localizedOn
                            : messages.localizedOff
                    )}
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
            {(spec.type === 'select' || spec.type === 'multiselect') && (
                <SelectOptionsEditor field={spec} onChange={editor.setSpec} />
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
