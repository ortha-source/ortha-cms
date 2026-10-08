import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import { takesDefaultValue } from '@orthacms/content-domain';
import type { FieldDoc } from '@orthacms/schema-builder-domain';
import { DateDefault } from './DateDefault';
import { ManyDefault } from './ManyDefault';
import { OneOfDefault } from './OneOfDefault';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.default.label',
        defaultMessage: 'Default value'
    },
    hint: {
        id: 'schemaBuilder.default.hint',
        defaultMessage:
            'Pre-fills the form when someone creates an entry. Entries that already exist, and entries created through the API, are not changed.'
    },
    none: { id: 'schemaBuilder.default.none', defaultMessage: 'No default' },
    on: { id: 'schemaBuilder.default.on', defaultMessage: 'Enabled' },
    off: { id: 'schemaBuilder.default.off', defaultMessage: 'Disabled' }
});

const ID = 'field-default';
const HINT_ID = `${ID}-hint`;

type Props = {
    spec: FieldDoc;
    onChange: (patch: Record<string, unknown>) => void;
};

/**
 * The field's `defaultValue` — a control shaped like the value, and the hint
 * that says what it is: a prefill for the create form, not a stored default.
 * Not offered on a relation or media field, whose value names a row.
 */
export function DefaultValueField({ spec, onChange }: Props) {
    const intl = useIntl();
    if (!takesDefaultValue(spec.type)) return null;
    const value = (spec as { defaultValue?: unknown }).defaultValue;
    const set = (defaultValue: unknown) => onChange({ defaultValue });
    const label = intl.formatMessage(messages.label);
    const noneLabel = intl.formatMessage(messages.none);
    const hint = intl.formatMessage(messages.hint);

    const control = (() => {
        switch (spec.type) {
            case 'boolean':
                return (
                    <OneOfDefault
                        id={ID}
                        label={label}
                        noneLabel={noneLabel}
                        describedBy={HINT_ID}
                        value={value === undefined ? undefined : String(value)}
                        choices={[
                            {
                                value: 'true',
                                label: intl.formatMessage(messages.on)
                            },
                            {
                                value: 'false',
                                label: intl.formatMessage(messages.off)
                            }
                        ]}
                        onChange={(next) =>
                            set(
                                next === undefined ? undefined : next === 'true'
                            )
                        }
                    />
                );
            case 'select':
                return (
                    <OneOfDefault
                        id={ID}
                        label={label}
                        noneLabel={noneLabel}
                        describedBy={HINT_ID}
                        value={value as string | undefined}
                        choices={spec.options.map((option) => ({
                            value: option,
                            label: <span className="font-mono">{option}</span>
                        }))}
                        onChange={set}
                    />
                );
            case 'multiselect':
                return (
                    <ManyDefault
                        id={ID}
                        label={label}
                        describedBy={HINT_ID}
                        value={Array.isArray(value) ? value : []}
                        options={spec.options}
                        onChange={set}
                    />
                );
            case 'date':
            case 'datetime':
                return (
                    <DateDefault
                        id={ID}
                        label={label}
                        noneLabel={noneLabel}
                        describedBy={HINT_ID}
                        withTime={spec.type === 'datetime'}
                        value={value as string | undefined}
                        onChange={set}
                    />
                );
            case 'number':
            case 'money':
                return (
                    <InputField
                        id={ID}
                        type="number"
                        inputMode="decimal"
                        label={label}
                        aria-describedby={HINT_ID}
                        value={value === undefined ? '' : String(value)}
                        onChange={(event) =>
                            set(
                                event.target.value === ''
                                    ? undefined
                                    : Number(event.target.value)
                            )
                        }
                    />
                );
            default:
                return (
                    <InputField
                        id={ID}
                        label={label}
                        aria-describedby={HINT_ID}
                        value={(value as string | undefined) ?? ''}
                        onChange={(event) => set(event.target.value)}
                    />
                );
        }
    })();

    return (
        <div className="flex flex-col gap-1.5">
            {control}
            <p id={HINT_ID} className="text-xs text-muted-foreground">
                {hint}
            </p>
        </div>
    );
}
