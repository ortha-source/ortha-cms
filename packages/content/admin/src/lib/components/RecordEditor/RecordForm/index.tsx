import { defineMessages, useIntl } from 'react-intl';
import type { CollectionMeta } from '../../../types/recordDraft';
import type { FieldState } from '../../../hooks/useRecordEditor';
import { RecordField } from './RecordField';
import { GroupedFields } from './GroupedFields';

const messages = defineMessages({
    localePill: {
        id: 'content.record.localePill',
        defaultMessage: '{code} · {label}'
    }
});

/** Above this field count the island splits into Properties/Content groups. */
const GROUP_THRESHOLD = 12;

/**
 * The center form island: a white card with the collection header (name + locale
 * pill + description) and the fields, one per line. Below {@link GROUP_THRESHOLD}
 * fields it renders them in schema order; above it, it defers to
 * {@link GroupedFields} for the Properties/Content split. Every field carries the
 * active-indicator border and a `scroll-margin-top` so the outline's jump lands
 * it cleanly.
 */
export function RecordForm({
    collection,
    localeCode,
    localeLabel,
    fieldStates,
    activeKey,
    expanded,
    onToggleExpand,
    onChange,
    onBlur
}: {
    collection: CollectionMeta;
    localeCode: string;
    localeLabel: string;
    fieldStates: FieldState[];
    activeKey?: string;
    /** Which long-form fields are currently expanded, by key. */
    expanded: Record<string, boolean>;
    onToggleExpand: (key: string) => void;
    onChange: (key: string, value: unknown) => void;
    onBlur: (key: string) => void;
}) {
    const intl = useIntl();
    const grouped = fieldStates.length > GROUP_THRESHOLD;

    const renderField = (state: FieldState) => (
        <RecordField
            key={state.field.key}
            state={state}
            active={state.field.key === activeKey}
            expanded={expanded[state.field.key] ?? false}
            onToggleExpand={() => onToggleExpand(state.field.key)}
            onChange={(value) => onChange(state.field.key, value)}
            onBlur={() => onBlur(state.field.key)}
        />
    );

    return (
        <div className="mx-auto max-w-[820px] rounded-2xl border bg-background px-9 py-7">
            <header className="mb-[26px]">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {collection.label}
                    </h1>
                    <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.localePill, {
                            code: localeCode.toUpperCase(),
                            label: localeLabel
                        })}
                    </span>
                </div>
                {collection.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {collection.description}
                    </p>
                ) : null}
            </header>

            {grouped ? (
                <GroupedFields fieldStates={fieldStates} render={renderField} />
            ) : (
                <div className="flex flex-col gap-[22px]">
                    {fieldStates.map(renderField)}
                </div>
            )}
        </div>
    );
}
