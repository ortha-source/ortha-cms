import { defineMessages, useIntl } from 'react-intl';
import { orderGeneralTab } from '@orthacms/content-domain';
import type {
    ContentField,
    ContentFieldGroup
} from '../../../../../domain/types/contentType';
import { sectionFields } from '../../../../../domain/fieldSections';
import type { EntryFormState } from '../../../../hooks/useEntryForm';
import { FieldSection } from './FieldSection';
import { FieldStack } from './FieldStack';

const messages = defineMessages({
    sharedPrefilled: {
        id: 'content.form.group.sharedPrefilled',
        defaultMessage:
            'The fields marked “All locales” were copied from the {locale} version and are still written in that language. Translate them here and they change in every locale.'
    },
    requiredLegend: {
        id: 'content.form.requiredLegend',
        defaultMessage:
            'Fields marked * are required before this entry can be published.'
    },
    requiredLegendLive: {
        id: 'content.form.requiredLegendLive',
        defaultMessage: 'Fields marked * are required.'
    }
});

/**
 * States what the `*` beside a field label means, once, above the fields.
 *
 * `RequiredMark` used to say it in a native `title` on an `aria-hidden` span —
 * mouse-only, not dismissible, and unreachable by assistive tech (`ORT-90`).
 * A form-wide convention belongs to the form, not to each of its labels: said
 * here it is visible to everyone, announced once instead of on every field, and
 * there is nothing to hover.
 *
 * Rendered only when something on screen is actually marked, and worded for
 * the type: a non-publishable type has no publishing to be required *for* — it
 * refuses an incomplete save instead — so it is not told about one.
 */
function RequiredLegend({
    fields,
    publishable
}: {
    fields: ContentField[];
    publishable: boolean;
}) {
    const intl = useIntl();
    if (!fields.some((field) => field.required)) return null;

    return (
        <p className="text-muted-foreground text-xs">
            {intl.formatMessage(
                publishable
                    ? messages.requiredLegend
                    : messages.requiredLegendLive
            )}
        </p>
    );
}

/**
 * The entry form: every field the reader may edit — relations and media
 * included — in **one** flush block, drawn the way the schema lays it out:
 * the fields above every section first (ordered by control shape, then
 * relations and media), then each declared section in declaration order with
 * its fields in the author's order. Pairing follows only `admin.width` /
 * `admin.row` (see `FieldStack`). A relation is drawn by the editor through
 * `EntryFieldResources.renderField`, since its links are staged there.
 */
export function EntryFieldSections({
    fields,
    groups,
    typeName,
    form,
    isChanged,
    contentLocale,
    prefilledFromLocale,
    publishable = true
}: {
    fields: ContentField[];
    /** The type's declared form sections, when it has any. */
    groups?: readonly ContentFieldGroup[];
    /** The open content type — keys each section's remembered open state. */
    typeName: string;
    form: EntryFormState;
    /** Whether a field has unsaved edits (drives its "Changed" badge). */
    isChanged?: (name: string) => boolean;
    /**
     * BCP-47 tag of the locale a translation prefill copied the **shared**
     * values from — set only on a create seeded that way. Marks and explains
     * that run; see the comment at its call site (`ORT-87`).
     */
    prefilledFromLocale?: string;
    /**
     * The row's own locale, on a localized type — a **BCP-47 language tag** by
     * the i18n plugin's wire contract, so it goes on the translated group
     * verbatim as `lang`.
     *
     * Without it every locale's content sat inside the admin's hardcoded
     * `<html lang="en">`, and a screen reader read German, French and Arabic
     * prose with English pronunciation rules — the most audible failure a
     * localization tool can have (WCAG 3.1.2).
     */
    contentLocale?: string;
    /** Whether the type has a publish step — words the required legend. */
    publishable?: boolean;
}) {
    const intl = useIntl();
    // Field ordering by control shape — inputs, then choices, then large
    // fields, then relations and media. The ranks live in content-domain so the
    // schema builder shows the same order this form draws. Inside a section the
    // schema author's declaration order is kept instead.
    const ordered = orderGeneralTab(fields);

    if (ordered.length === 0) return null;

    // One form: the fields above every section, then each declared section.
    // It used to split a localized type into "Translated" and "Shared" runs;
    // that put the schema's order second to a storage detail, so it is gone,
    // and each field says its locale scope beside its own label instead (the
    // globe, or "All locales" — `EntryFieldInput`). Each localized field keeps
    // its own `lang`; a shared one holds one value for every locale and gets
    // none, except on a fresh translation prefill (`sharedLang`).
    const { ungrouped, sections } = sectionFields(fields, groups);
    const loose = new Set(ungrouped);
    return (
        <div className="flex flex-col gap-6" dir="auto">
            <RequiredLegend fields={ordered} publishable={publishable} />
            {prefilledFromLocale ? (
                // A prefill is the one moment the shared values' language is
                // known — they were copied verbatim from another row seconds
                // ago — so it is marked and said out loud (WCAG 3.1.2, 508
                // 504.3 — `ORT-87`). It stops being true the moment the author
                // edits or saves, which is why nothing persists it.
                <p
                    data-testid="entry-shared-prefilled"
                    className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                >
                    {intl.formatMessage(messages.sharedPrefilled, {
                        locale: prefilledFromLocale
                    })}
                </p>
            ) : null}
            {ungrouped.length > 0 && (
                <FieldStack
                    fields={ordered.filter((field) => loose.has(field))}
                    form={form}
                    isChanged={isChanged}
                    localizedLang={contentLocale}
                    sharedLang={prefilledFromLocale}
                />
            )}
            {sections.length > 0 && (
                <div className="flex flex-col gap-4">
                    {sections.map((section) => (
                        <FieldSection
                            key={section.group.key}
                            section={section}
                            typeName={typeName}
                            form={form}
                            isChanged={isChanged}
                            localizedLang={contentLocale}
                            sharedLang={prefilledFromLocale}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
