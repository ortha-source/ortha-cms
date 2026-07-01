import { defineMessages, useIntl } from 'react-intl';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    InputField,
    MultiSelect,
    SegmentedControl,
    SegmentedControlItem,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea
} from '@ortha-cms/design-system';
import type { ContentField } from '../../types/contentType';
import { fieldLabel } from '../../utils/entryColumns';
import { adminProps } from '../../utils/adminProps';
import { CONTENT_FIELD_TYPE } from '../../constants';
import { DateField } from './DateField';

const messages = defineMessages({
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
    },
    enabled: {
        id: 'content.form.enabled',
        defaultMessage: 'Enabled'
    },
    disabled: {
        id: 'content.form.disabled',
        defaultMessage: 'Disabled'
    }
});

/** Segment values for the boolean enabled/disabled control. */
const BOOL_SEGMENT = { On: 'on', Off: 'off' } as const;

/** Flat controls — the field surfaces carry a border, never a shadow. */
const FLAT = 'shadow-none';

/** The value coerced to a string for text-like controls. */
function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
}

/**
 * Renders the right control for one content field, driven by `field.type`:
 * text/number/money/date/datetime/single-relation use the composite
 * {@link InputField}; richtext/json/many-relation use a `Textarea`; `boolean` an
 * Enabled/Disabled {@link SegmentedControl}; `select` a `Select`; `multiselect`
 * the {@link MultiSelect}. Every control
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
    // The error message takes the description's place, so suppress the hint
    // (and any type-specific fallback hint below) whenever the field is invalid.
    const description = error ? undefined : admin.description;
    // Associate the error with the control so a screen reader reads it on focus,
    // not only when it first appears. (InputField wires its own id internally.)
    const errorId = `${id}-error`;
    const describedBy = error ? errorId : undefined;

    switch (field.type) {
        case CONTENT_FIELD_TYPE.Boolean:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel id={`${id}-label`}>{label}</FieldLabel>
                    <SegmentedControl
                        aria-labelledby={`${id}-label`}
                        aria-invalid={!!error}
                        aria-describedby={describedBy}
                        value={
                            value === true
                                ? BOOL_SEGMENT.On
                                : BOOL_SEGMENT.Off
                        }
                        onValueChange={(next) => {
                            // Radix clears the value when the active item is
                            // re-pressed; ignore that so the field stays set.
                            if (next) onChange(next === BOOL_SEGMENT.On);
                            onBlur?.();
                        }}
                    >
                        <SegmentedControlItem value={BOOL_SEGMENT.On}>
                            {intl.formatMessage(messages.enabled)}
                        </SegmentedControlItem>
                        <SegmentedControlItem value={BOOL_SEGMENT.Off}>
                            {intl.formatMessage(messages.disabled)}
                        </SegmentedControlItem>
                    </SegmentedControl>
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError id={errorId}>{error}</FieldError>}
                </Field>
            );

        case CONTENT_FIELD_TYPE.Select:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <Select
                        value={asText(value) || undefined}
                        onValueChange={(next) => {
                            onChange(next);
                            onBlur?.();
                        }}
                    >
                        <SelectTrigger
                            id={id}
                            aria-invalid={!!error}
                            aria-describedby={describedBy}
                            className={FLAT}
                        >
                            <SelectValue
                                placeholder={intl.formatMessage(
                                    messages.selectPlaceholder
                                )}
                            />
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
                    {error && <FieldError id={errorId}>{error}</FieldError>}
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
                        onChange={(next) => {
                            onChange(next);
                            onBlur?.();
                        }}
                        invalid={!!error}
                        aria-describedby={describedBy}
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
                    {error && <FieldError id={errorId}>{error}</FieldError>}
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
                        aria-describedby={describedBy}
                        placeholder={admin.placeholder}
                        onChange={(event) => onChange(event.target.value)}
                        onBlur={onBlur}
                    />
                    {!error && (description || isJson) && (
                        <FieldDescription>
                            {description ??
                                (isJson
                                    ? intl.formatMessage(messages.jsonHint)
                                    : null)}
                        </FieldDescription>
                    )}
                    {error && <FieldError id={errorId}>{error}</FieldError>}
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
                            aria-describedby={describedBy}
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
                        {!error && (
                            <FieldDescription>
                                {description ??
                                    intl.formatMessage(
                                        messages.relationManyHint
                                    )}
                            </FieldDescription>
                        )}
                        {error && <FieldError id={errorId}>{error}</FieldError>}
                    </Field>
                );
            }
            return (
                <InputField
                    id={id}
                    label={label}
                    value={asText(value)}
                    description={
                        error
                            ? undefined
                            : (description ??
                              intl.formatMessage(messages.relationHint))
                    }
                    error={error}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    className={`${FLAT} font-mono text-xs`}
                />
            );
        }

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
                        aria-describedby={describedBy}
                    />
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {error && <FieldError id={errorId}>{error}</FieldError>}
                </Field>
            );

        case CONTENT_FIELD_TYPE.Number:
        case CONTENT_FIELD_TYPE.Money:
        case CONTENT_FIELD_TYPE.Text:
        default: {
            // Number/money use a numeric input; text (and any unlisted type)
            // a plain one — otherwise the same single-line composite field.
            const numeric =
                field.type === CONTENT_FIELD_TYPE.Number ||
                field.type === CONTENT_FIELD_TYPE.Money;
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
                    {...(numeric
                        ? { type: 'number', inputMode: 'decimal' as const }
                        : {})}
                />
            );
        }
    }
}
