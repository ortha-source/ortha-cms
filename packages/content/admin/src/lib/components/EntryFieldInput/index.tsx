import { defineMessages, useIntl } from 'react-intl';
import {
    Checkbox,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    InputField,
    Label,
    MultiSelect,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea
} from '@ortha-cms/design-system';
import type { ContentField } from '../../types/contentType';
import { fieldLabel } from '../../utils/entryColumns';
import { CONTENT_FIELD_TYPE } from '../../constants';
import { DateField } from './DateField';

const messages = defineMessages({
    optional: {
        id: 'content.form.optional',
        defaultMessage: 'Optional'
    },
    selectPlaceholder: {
        id: 'content.form.selectPlaceholder',
        defaultMessage: 'Select…'
    },
    searchPlaceholder: {
        id: 'content.form.searchPlaceholder',
        defaultMessage: 'Search…'
    },
    noResults: {
        id: 'content.form.noResults',
        defaultMessage: 'No matches.'
    },
    relationHint: {
        id: 'content.form.relationHint',
        defaultMessage:
            'Enter the related entry id (a relation picker is coming soon).'
    },
    relationManyHint: {
        id: 'content.form.relationManyHint',
        defaultMessage:
            'One entry id per line (a relation picker is coming soon).'
    },
    jsonHint: {
        id: 'content.form.jsonHint',
        defaultMessage: 'Raw JSON.'
    }
});

/** Flat controls — the field surfaces carry a border, never a shadow. */
const FLAT = 'shadow-none';

/** A field's admin presentation hints, with the loose wire typing. */
function adminProps(field: ContentField) {
    return field.admin as {
        description?: string;
        placeholder?: string;
        widget?: string;
        hidden?: boolean;
    };
}

/** The value coerced to a string for text-like controls. */
function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
}

/**
 * Renders the right control for one content field, driven by `field.type`:
 * text/number/money/date/datetime/single-relation use the composite
 * {@link InputField}; richtext/json/many-relation use a `Textarea`; `boolean` a
 * `Checkbox`; `select` a `Select`; `multiselect` a checkbox group. Every control
 * is **flat** (border, no shadow). Fully controlled — the form owns
 * `value`/`error`; this is presentation only.
 */
export function EntryFieldInput({
    field,
    value,
    error,
    onChange,
    onBlur
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
}) {
    const intl = useIntl();
    const id = `entry-field-${field.name}`;
    const label = fieldLabel(field);
    const admin = adminProps(field);
    const description = admin.description;
    const optional = !field.required
        ? intl.formatMessage(messages.optional)
        : undefined;

    switch (field.type) {
        case CONTENT_FIELD_TYPE.Boolean:
            return (
                <Field data-invalid={!!error}>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id={id}
                            checked={value === true}
                            onCheckedChange={(checked) =>
                                onChange(checked === true)
                            }
                            onBlur={onBlur}
                            aria-invalid={!!error}
                            className={FLAT}
                        />
                        <Label htmlFor={id}>{label}</Label>
                    </div>
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError>{error}</FieldError>}
                </Field>
            );

        case CONTENT_FIELD_TYPE.Select:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <Select
                        value={asText(value) || undefined}
                        onValueChange={onChange}
                    >
                        <SelectTrigger
                            id={id}
                            aria-invalid={!!error}
                            className={FLAT}
                        >
                            <SelectValue placeholder={optional ?? label} />
                        </SelectTrigger>
                        <SelectContent>
                            {(field.options ?? []).map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError>{error}</FieldError>}
                </Field>
            );

        case CONTENT_FIELD_TYPE.Multiselect: {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            const options = (field.options ?? []).map((option) => ({
                value: option,
                label: option
            }));
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <MultiSelect
                        id={id}
                        options={options}
                        value={selected}
                        onChange={onChange}
                        invalid={!!error}
                        placeholder={intl.formatMessage(
                            messages.selectPlaceholder
                        )}
                        searchPlaceholder={intl.formatMessage(
                            messages.searchPlaceholder
                        )}
                        emptyText={intl.formatMessage(messages.noResults)}
                    />
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError>{error}</FieldError>}
                </Field>
            );
        }

        case CONTENT_FIELD_TYPE.RichText:
        case CONTENT_FIELD_TYPE.Json: {
            const isJson = field.type === CONTENT_FIELD_TYPE.Json;
            const display = isJson
                ? typeof value === 'string'
                    ? value
                    : JSON.stringify(value, null, 2)
                : asText(value);
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <Textarea
                        id={id}
                        value={display}
                        rows={isJson ? 6 : 4}
                        className={isJson ? `${FLAT} font-mono text-xs` : FLAT}
                        aria-invalid={!!error}
                        placeholder={admin.placeholder}
                        onChange={(event) => onChange(event.target.value)}
                        onBlur={onBlur}
                    />
                    {(description || isJson) && (
                        <FieldDescription>
                            {description ??
                                (isJson
                                    ? intl.formatMessage(messages.jsonHint)
                                    : null)}
                        </FieldDescription>
                    )}
                    {error && <FieldError>{error}</FieldError>}
                </Field>
            );
        }

        case CONTENT_FIELD_TYPE.Relation: {
            if (field.relation?.many) {
                const ids = Array.isArray(value) ? (value as string[]) : [];
                return (
                    <Field data-invalid={!!error}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <Textarea
                            id={id}
                            value={ids.join('\n')}
                            rows={3}
                            className={`${FLAT} font-mono text-xs`}
                            aria-invalid={!!error}
                            onChange={(event) =>
                                onChange(
                                    event.target.value
                                        .split(/[\s,]+/)
                                        .map((part) => part.trim())
                                        .filter(Boolean)
                                )
                            }
                            onBlur={onBlur}
                        />
                        <FieldDescription>
                            {description ??
                                intl.formatMessage(messages.relationManyHint)}
                        </FieldDescription>
                        {error && <FieldError>{error}</FieldError>}
                    </Field>
                );
            }
            return (
                <InputField
                    id={id}
                    label={label}
                    value={asText(value)}
                    description={
                        description ?? intl.formatMessage(messages.relationHint)
                    }
                    error={error}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    className={`${FLAT} font-mono text-xs`}
                />
            );
        }

        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
            return (
                <InputField
                    id={id}
                    type="number"
                    inputMode="decimal"
                    label={label}
                    value={asText(value)}
                    description={description}
                    placeholder={admin.placeholder}
                    error={error}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    className={FLAT}
                />
            );

        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <DateField
                        id={id}
                        value={asText(value)}
                        onChange={onChange}
                        onBlur={onBlur}
                        withTime={field.type === CONTENT_FIELD_TYPE.Datetime}
                        invalid={!!error}
                    />
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError>{error}</FieldError>}
                </Field>
            );

        case CONTENT_FIELD_TYPE.Text:
        default:
            return (
                <InputField
                    id={id}
                    label={label}
                    value={asText(value)}
                    description={description}
                    placeholder={admin.placeholder}
                    error={error}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    className={FLAT}
                />
            );
    }
}
