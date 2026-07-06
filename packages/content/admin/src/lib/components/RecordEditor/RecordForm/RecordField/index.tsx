import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import { isLongForm } from '../../../../types/recordDraft';
import type { FieldState } from '../../../../hooks/useRecordEditor';
import { FieldRenderer } from '../../FieldRenderer';

const messages = defineMessages({
    collapse: { id: 'content.record.collapse', defaultMessage: 'Collapse' },
    expand: { id: 'content.record.expand', defaultMessage: 'Expand' },
    emptyPreview: {
        id: 'content.record.emptyPreview',
        defaultMessage: 'Empty — {description}'
    },
    emptyPlain: { id: 'content.record.emptyPlain', defaultMessage: 'Empty' }
});

/** Format money minor units as a currency preview (`= $19.99`). */
function moneyPreview(value: unknown): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `= $${(value / 100).toFixed(2)}`;
}

/** One-line, ellipsized preview of a long-form value for its collapsed row. */
function longPreview(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
}

/**
 * A single field line: the active-indicator border, label, control, and
 * helper/error. Long-form fields (`richtext`/`textarea`/`json`) are collapsible
 * — collapsed they show a one-line summary row; expanded they carry a Collapse
 * button and the full editor.
 */
export function RecordField({
    state,
    active,
    expanded,
    onToggleExpand,
    onChange,
    onBlur
}: {
    state: FieldState;
    active: boolean;
    expanded: boolean;
    onToggleExpand: () => void;
    onChange: (value: unknown) => void;
    onBlur: () => void;
}) {
    const intl = useIntl();
    const { field, value, error, filled } = state;
    const inputId = `input-${field.key}`;
    const helpId = `help-${field.key}`;
    const long = isLongForm(field.type);
    // Show an error only once the field has been touched, so a pristine required
    // field reads as "empty" (outline dot) rather than shouting on first paint.
    const showError = error && state.touched ? error : undefined;
    const describedById = showError || field.description ? helpId : undefined;

    const wrapperClass = cn(
        '-ml-[18px] scroll-mt-[90px] border-l-2 pl-4',
        active ? 'border-foreground' : 'border-transparent'
    );

    const labelNode = (
        <label htmlFor={inputId} className="text-[13px] font-medium">
            {field.label}
            {field.required ? (
                <span className="text-destructive"> *</span>
            ) : null}
        </label>
    );

    // Collapsed long-form: a single self-contained clickable summary row (its
    // 120px label cell stands in for the field label, so no header above it).
    if (long && !expanded) {
        const preview = longPreview(value);
        return (
            <div
                id={`f-${field.key}`}
                data-field-key={field.key}
                className={wrapperClass}
            >
                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-expanded={false}
                    aria-label={field.label}
                    className="flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                >
                    <span className="w-[120px] shrink-0 truncate text-[13px] font-medium">
                        {field.label}
                    </span>
                    <span
                        className={cn(
                            'min-w-0 flex-1 truncate text-[13px] text-muted-foreground',
                            field.type === 'json' && 'font-mono'
                        )}
                    >
                        {preview ||
                            intl.formatMessage(
                                field.description
                                    ? messages.emptyPreview
                                    : messages.emptyPlain,
                                { description: field.description }
                            )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.expand)}
                        <ChevronDown className="size-3" aria-hidden />
                    </span>
                </button>
            </div>
        );
    }

    // Money's live currency preview rides in the helper line when a value is set.
    const preview =
        field.type === 'money' && filled ? moneyPreview(value) : null;
    const helperText = showError
        ? showError
        : [field.description, preview].filter(Boolean).join('  ');

    return (
        <div
            id={`f-${field.key}`}
            data-field-key={field.key}
            className={cn('flex flex-col gap-1.5', wrapperClass)}
        >
            {long ? (
                <div className="flex items-center justify-between">
                    {labelNode}
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        aria-expanded
                        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {intl.formatMessage(messages.collapse)}
                        <ChevronUp className="size-3" aria-hidden />
                    </button>
                </div>
            ) : (
                labelNode
            )}

            <FieldRenderer
                field={field}
                value={value}
                invalid={!!showError}
                inputId={inputId}
                describedById={describedById}
                onChange={onChange}
                onBlur={onBlur}
            />

            {helperText ? (
                <p
                    id={helpId}
                    className={cn(
                        'text-xs',
                        showError ? 'text-destructive' : 'text-muted-foreground'
                    )}
                >
                    {helperText}
                </p>
            ) : null}
        </div>
    );
}
