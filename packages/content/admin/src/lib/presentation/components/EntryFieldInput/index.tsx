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
import type { ContentField } from '../../../domain/types/contentType';
import { fieldLabel } from '../../../domain/entryColumns';
import { adminProps } from '../../../domain/adminProps';
import { CONTENT_FIELD_TYPE } from '../../../domain/constants';
import { ENTRY_FIELD_CONTROL_SLOT } from '../../slots/contentSlots';
import { useExpandedField } from '../../hooks/useExpandedField';
import { useEntryReadOnly } from '../../hooks/useEntryReadOnly';
import { ChangedBadge } from '../ChangedBadge';
import { DateField } from './DateField';
import { LocalizedFieldMark } from './LocalizedFieldMark';
import { RequiredMark } from './RequiredMark';

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
 * A numeric control's raw input string coerced to the `number` the validation
 * kernel — and the write API — expect. An `<input type="number">` still hands
 * back a *string*, so without this every `number`/`money` field failed the
 * kernel's `typeof value === 'number'` check and reported "Must be a number"
 * for a perfectly valid entry.
 *
 * An empty box clears the field (`undefined`, so a non-required field reads as
 * empty rather than `NaN`); an unparseable string is passed through untouched
 * so the resulting error still describes what the user actually typed.
 */
function asNumber(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? raw : parsed;
}

/**
 * Renders the right control for one content field, driven by `field.type`:
 * text/number/money/date/datetime/single-relation use the composite
 * {@link InputField}; richtext/json/many-relation use a `Textarea`; `boolean` an
 * Enabled/Disabled {@link SegmentedControl}; `select` a `Select`; `multiselect`
 * the {@link MultiSelect}. Every control
 * is **flat** (border, no shadow). Fully controlled — the form owns
 * `value`/`error`; this is presentation only.
 *
 * A plugin can take a field's **input** over via `ENTRY_FIELD_CONTROL_SLOT`,
 * checked before the type switch; the label row, description, and error stay
 * here either way.
 *
 * In a **read-only** editor (`useEntryReadOnly` — the reader has no
 * `content:update`/`content:create`) every control renders as a preview. Text
 * and textarea controls take `readOnly` rather than `disabled`, so the value
 * stays legible, focusable, and selectable — a reader who can't edit a record
 * can still read and copy out of it. The controls with no read-only state of
 * their own (select, multi-select, the boolean segments, the date picker) fall
 * back to `disabled`, which is the only way to close their popover off.
 */
export function EntryFieldInput({
    field,
    value,
    error,
    changed = false,
    onChange,
    onBlur
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    /** Whether the field holds an unsaved edit (shows a "Changed" badge). */
    changed?: boolean;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
}) {
    const intl = useIntl();
    const expandedField = useExpandedField();
    const readOnly = useEntryReadOnly();
    const id = `entry-field-${field.name}`;
    const label = fieldLabel(field);
    // The label row's right-hand adornments, kept together so they never
    // collide: the "Changed" badge (unsaved edit) and, for a `localized` field
    // (only ever on i18n types), a globe mark. `ml-auto` pushes the pair to the
    // far right of the label row — in a `w-full` `FieldLabel` or `InputField`'s
    // `labelAction` slot. Null when the field has neither.
    const endAdornment =
        changed || field.localized ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {changed ? <ChangedBadge /> : null}
                {field.localized ? <LocalizedFieldMark /> : null}
            </span>
        ) : null;
    // The label plus its required marker. The mark is presentational (the
    // controls below carry `aria-required`, which is what gets announced), so
    // it composes into the label node rather than the accessible name.
    //
    // Wrapped in **one** element on purpose: `FieldLabel` is a flex row with a
    // `gap-2`, and a bare fragment makes the text and the asterisk two separate
    // flex items — so the gap lands between them and the `*` floats 8px off the
    // word it belongs to. As one item they sit together, spaced only by the
    // mark's own hair-space margin.
    const labelNode = field.required ? (
        <span>
            {label}
            <RequiredMark />
        </span>
    ) : (
        label
    );
    // Mirrors the marker for assistive tech, spread onto each control.
    const requiredProps = field.required ? { 'aria-required': true } : {};
    // Read-only for the controls that have one (`<input>`, `<textarea>`): the
    // value stays focusable, selectable, and full-contrast, which is what makes
    // this a preview rather than a greyed-out husk. Everything else in the
    // switch below uses `disabled` — see the component JSDoc.
    const readOnlyProps = readOnly ? { readOnly: true } : {};
    const admin = adminProps(field);
    // The error message takes the description's place, so suppress the hint
    // (and any type-specific fallback hint below) whenever the field is invalid.
    const description = error ? undefined : admin.description;
    // Associate the error with the control so a screen reader reads it on focus,
    // not only when it first appears. (InputField wires its own id internally.)
    const errorId = `${id}-error`;
    const describedBy = error ? errorId : undefined;

    // A plugin may own this field's control (ENTRY_FIELD_CONTROL_SLOT — the
    // WYSIWYG plugin claims `richtext`). Only the *input* is handed over: the
    // label row, description, and error stay here, so a contributed control
    // can't drift from the built-ins on the required mark, the Changed badge,
    // the localized globe, or the error wiring. A plain `find` is right — this
    // slot holds components, not hooks, so nothing runs until one is mounted.
    const contributed = ENTRY_FIELD_CONTROL_SLOT.getItems().find((item) =>
        item.appliesTo(field)
    );
    if (contributed) {
        const { Component } = contributed;
        // Expanding is only offered when the item has something to expand
        // *into*; without a `FullView` the request would swap the tab strip for
        // a blank pane. `EntryEditor` owns the state — it is what renders the
        // expanded view — so this only reads and forwards it.
        const canExpand = !!contributed.FullView;
        return (
            <Field data-invalid={!!error}>
                <FieldLabel
                    htmlFor={id}
                    className={endAdornment ? 'w-full' : undefined}
                >
                    {labelNode}
                    {endAdornment}
                </FieldLabel>
                <Component
                    field={field}
                    id={id}
                    label={label}
                    value={value}
                    error={error}
                    describedBy={describedBy}
                    readOnly={readOnly}
                    onChange={onChange}
                    onBlur={onBlur}
                    expanded={canExpand && expandedField.name === field.name}
                    setExpanded={(next) => {
                        if (!canExpand) return;
                        expandedField.setName(next ? field.name : null);
                    }}
                />
                {description && (
                    <FieldDescription>{description}</FieldDescription>
                )}
                {error && <FieldError id={errorId}>{error}</FieldError>}
            </Field>
        );
    }

    switch (field.type) {
        case CONTENT_FIELD_TYPE.Boolean:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel
                        id={`${id}-label`}
                        className={endAdornment ? 'w-full' : undefined}
                    >
                        {labelNode}
                        {endAdornment}
                    </FieldLabel>
                    <SegmentedControl
                        aria-labelledby={`${id}-label`}
                        aria-invalid={!!error}
                        {...requiredProps}
                        disabled={readOnly}
                        aria-describedby={describedBy}
                        value={
                            value === true ? BOOL_SEGMENT.On : BOOL_SEGMENT.Off
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
                    <FieldLabel
                        htmlFor={id}
                        className={endAdornment ? 'w-full' : undefined}
                    >
                        {labelNode}
                        {endAdornment}
                    </FieldLabel>
                    <Select
                        value={asText(value) || undefined}
                        disabled={readOnly}
                        onValueChange={(next) => {
                            onChange(next);
                            onBlur?.();
                        }}
                    >
                        <SelectTrigger
                            id={id}
                            aria-invalid={!!error}
                            {...requiredProps}
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
                    <FieldLabel
                        htmlFor={id}
                        className={endAdornment ? 'w-full' : undefined}
                    >
                        {labelNode}
                        {endAdornment}
                    </FieldLabel>
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
                        {...requiredProps}
                        disabled={readOnly}
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
                    <FieldLabel
                        htmlFor={id}
                        className={endAdornment ? 'w-full' : undefined}
                    >
                        {labelNode}
                        {endAdornment}
                    </FieldLabel>
                    <Textarea
                        id={id}
                        value={display}
                        rows={isJson ? 6 : 4}
                        {...requiredProps}
                        {...readOnlyProps}
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
                        <FieldLabel
                            htmlFor={id}
                            className={endAdornment ? 'w-full' : undefined}
                        >
                            {labelNode}
                            {endAdornment}
                        </FieldLabel>
                        <Textarea
                            id={id}
                            value={ids.join('\n')}
                            rows={3}
                            {...requiredProps}
                            {...readOnlyProps}
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
                    label={labelNode}
                    labelAction={endAdornment ?? undefined}
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
                    {...requiredProps}
                    {...readOnlyProps}
                />
            );
        }

        case CONTENT_FIELD_TYPE.Date:
        case CONTENT_FIELD_TYPE.Datetime:
            return (
                <Field data-invalid={!!error}>
                    <FieldLabel
                        htmlFor={id}
                        className={endAdornment ? 'w-full' : undefined}
                    >
                        {labelNode}
                        {endAdornment}
                    </FieldLabel>
                    <DateField
                        id={id}
                        value={asText(value)}
                        onChange={onChange}
                        onBlur={onBlur}
                        withTime={field.type === CONTENT_FIELD_TYPE.Datetime}
                        invalid={!!error}
                        disabled={readOnly}
                        {...requiredProps}
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
                    label={labelNode}
                    labelAction={endAdornment ?? undefined}
                    value={asText(value)}
                    description={description}
                    placeholder={admin.placeholder}
                    error={error}
                    onChange={(event) =>
                        onChange(
                            numeric
                                ? asNumber(event.target.value)
                                : event.target.value
                        )
                    }
                    onBlur={onBlur}
                    className={FLAT}
                    {...requiredProps}
                    {...readOnlyProps}
                    {...(numeric
                        ? { type: 'number', inputMode: 'decimal' as const }
                        : {})}
                />
            );
        }
    }
}
