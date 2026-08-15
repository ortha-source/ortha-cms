import type { ContentField } from '../../../../../../domain/types/contentType';
import type { EntryFormState } from '../../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../../EntryFieldInput';

/**
 * One titled run of fields in the General tab — the translated set or the
 * shared set. Header plus a flush stack of controls; the card chrome stays off,
 * matching the ungrouped layout it splits.
 */
export function FieldGroup({
    title,
    description,
    fields,
    form,
    isChanged,
    lang,
    dir
}: {
    /** Group heading (e.g. "Translated fields"). */
    title: string;
    /** One-line explanation of what the group means for this record. */
    description: string;
    /** The group's fields, already in display order. */
    fields: ContentField[];
    form: EntryFormState;
    isChanged?: (name: string) => boolean;
    /** BCP-47 tag of the language this group's values are in, when known. */
    lang?: string;
    /** Writing direction for the group's values. */
    dir?: 'ltr' | 'rtl' | 'auto';
}) {
    return (
        <section className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                </p>
            </div>
            {/* The language marker goes on the fields, not the section: the
                heading above is UI copy in the admin's own language, and
                wrapping it too would declare "Translated fields" to be German.
                Field *labels* do still inherit it — marking each control
                individually needs a `lang` pass-through in every branch of
                `EntryFieldInput`, which is tracked separately. */}
            <div className="flex flex-col gap-5" lang={lang} dir={dir}>
                {fields.map((field) => (
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
        </section>
    );
}
