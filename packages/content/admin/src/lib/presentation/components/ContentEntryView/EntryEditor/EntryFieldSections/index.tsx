import { defineMessages, useIntl } from 'react-intl';
import type { ContentField } from '../../../../../domain/types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../../../domain/constants';
import type { EntryFormState } from '../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../EntryFieldInput';
import { FieldGroup } from './FieldGroup';

const messages = defineMessages({
    translatedTitle: {
        id: 'content.form.group.translatedTitle',
        defaultMessage: 'Translated fields'
    },
    translatedBody: {
        id: 'content.form.group.translatedBody',
        defaultMessage: 'These hold a different value in each locale.'
    },
    sharedTitle: {
        id: 'content.form.group.sharedTitle',
        defaultMessage: 'Shared fields'
    },
    sharedBody: {
        id: 'content.form.group.sharedBody',
        defaultMessage:
            'These are the same in every locale — editing one here changes it everywhere.'
    }
});

/**
 * Field ordering, by control shape. Fields flow top-to-bottom in three tiers
 * by rank:
 *   0 — simple inputs (text, number, money, date, datetime)
 *   1 — choice controls (select, boolean, multi-select)
 *   2 — large fields (rich text, JSON)
 * Types not listed fall to the bottom — a safe default for any new field type.
 */
const FIELD_RANK: Record<string, number> = {
    [CONTENT_FIELD_TYPE.Text]: 0,
    [CONTENT_FIELD_TYPE.Number]: 0,
    [CONTENT_FIELD_TYPE.Money]: 0,
    [CONTENT_FIELD_TYPE.Date]: 0,
    [CONTENT_FIELD_TYPE.Datetime]: 0,
    [CONTENT_FIELD_TYPE.Select]: 1,
    [CONTENT_FIELD_TYPE.Boolean]: 1,
    [CONTENT_FIELD_TYPE.Multiselect]: 1,
    [CONTENT_FIELD_TYPE.RichText]: 2,
    [CONTENT_FIELD_TYPE.Wysiwyg]: 2,
    [CONTENT_FIELD_TYPE.Json]: 2
};

const DEFAULT_RANK = 3;

const rankFor = (type: string) => FIELD_RANK[type] ?? DEFAULT_RANK;

/**
 * The General tab body: every editable field in **one** flush block (no card
 * chrome — no border, background, or padding), ordered top-to-bottom by
 * control shape — simple inputs (text, number, dates) first, then choice
 * controls (select, boolean, multi-select), then the large fields (rich text,
 * JSON) last. No section headers: the order alone groups like with like. One
 * field per row — a single stacked column the user works through step by step.
 * Relation fields are handled by their own tab and excluded by the caller.
 */
export function EntryFieldSections({
    fields,
    form,
    isChanged
}: {
    fields: ContentField[];
    form: EntryFormState;
    /** Whether a field has unsaved edits (drives its "Changed" badge). */
    isChanged?: (name: string) => boolean;
}) {
    const intl = useIntl();
    const ordered = [...fields].sort(
        (a, b) => rankFor(a.type) - rankFor(b.type)
    );

    if (ordered.length === 0) return null;

    // On a localized type, per-locale and shared fields behave very differently
    // on save — editing a shared field changes it for *every* locale — so they
    // are split into two labelled runs rather than interleaved. Only i18n types
    // ever mark a field `localized`, so a plain type keeps the flat, header-free
    // layout below and is untouched by this.
    const translated = ordered.filter((field) => field.localized);
    const shared = ordered.filter((field) => !field.localized);

    if (translated.length === 0 || shared.length === 0) {
        return (
            <div className="flex flex-col gap-5">
                {ordered.map((field) => (
                    <EntryFieldInput
                        key={field.name}
                        field={field}
                        value={form.values[field.name]}
                        error={form.errorFor(field.name)}
                        changed={isChanged?.(field.name) ?? false}
                        onChange={(value) => form.setValue(field.name, value)}
                        onBlur={() => form.touch(field.name)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <FieldGroup
                title={intl.formatMessage(messages.translatedTitle)}
                description={intl.formatMessage(messages.translatedBody)}
                fields={translated}
                form={form}
                isChanged={isChanged}
            />
            <FieldGroup
                title={intl.formatMessage(messages.sharedTitle)}
                description={intl.formatMessage(messages.sharedBody)}
                fields={shared}
                form={form}
                isChanged={isChanged}
            />
        </div>
    );
}
