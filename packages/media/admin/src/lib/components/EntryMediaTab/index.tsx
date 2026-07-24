import { defineMessages, useIntl } from 'react-intl';
import { Globe } from 'lucide-react';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel
} from '@ortha-cms/design-system';
import {
    CONTENT_FIELD_TYPE,
    type ContentField,
    type EntryTabContext
} from '@ortha-cms/content-admin';
import { MediaFieldControl } from '../MediaFieldControl';
import type { MediaAccept } from '../../utils/mediaAccept';

const messages = defineMessages({
    subtitle: {
        id: 'media.tab.subtitle',
        defaultMessage:
            'Attach images and files from the Media Library, or upload new ones — uploads are added to the library too.'
    },
    changed: { id: 'media.tab.changed', defaultMessage: 'Changed' },
    localized: {
        id: 'media.tab.localized',
        defaultMessage: 'This asset varies per locale.'
    }
});

/** The display label for a field — its admin label, else its machine name. */
function labelOf(field: ContentField): string {
    const label = field.admin?.['label'];
    return typeof label === 'string' && label ? label : field.name;
}

/**
 * The entry editor's **Media tab**, contributed by the media plugin through
 * content-admin's `ENTRY_TAB_SLOT`. Renders one {@link MediaFieldControl} per
 * media field on the type, bound to the editor's shared form — so a change here
 * rides Save, the publish gate, and the 422→field mapping exactly like a
 * General-tab field. Media values live in the entry `values` bag; this tab is
 * only their rendering surface.
 */
export function EntryMediaTab(ctx: EntryTabContext) {
    const intl = useIntl();
    const { schema, form, mediaRefs } = ctx;
    const fields = schema.fields.filter(
        (field) => field.type === CONTENT_FIELD_TYPE.Media
    );

    if (fields.length === 0) return null;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.subtitle)}
            </p>
            {fields.map((field) => {
                const error = form.errorFor(field.name);
                const changed = form.isFieldDirty(field.name);
                const description = field.admin?.['description'];
                const errorId = `media-field-${field.name}-error`;
                return (
                    <Field key={field.name} data-invalid={!!error}>
                        <FieldLabel className="w-full" htmlFor={`media-field-${field.name}`}>
                            <span className="flex items-center gap-1">
                                {labelOf(field)}
                                {field.required ? (
                                    <span
                                        aria-hidden
                                        className="text-destructive"
                                    >
                                        *
                                    </span>
                                ) : null}
                            </span>
                            <span className="ml-auto flex items-center gap-1.5">
                                {changed ? (
                                    <span className="text-xs text-muted-foreground">
                                        {intl.formatMessage(messages.changed)}
                                    </span>
                                ) : null}
                                {field.localized ? (
                                    <Globe
                                        className="size-3.5 text-muted-foreground"
                                        aria-label={intl.formatMessage(
                                            messages.localized
                                        )}
                                    />
                                ) : null}
                            </span>
                        </FieldLabel>
                        <MediaFieldControl
                            id={`media-field-${field.name}`}
                            multiple={!!field.multiple}
                            accept={field.accept as MediaAccept | undefined}
                            required={field.required}
                            value={form.values[field.name]}
                            initialRefs={mediaRefs[field.name]}
                            invalid={!!error}
                            describedBy={error ? errorId : undefined}
                            onChange={(value) =>
                                form.setValue(field.name, value)
                            }
                            onBlur={() => form.touch(field.name)}
                        />
                        {!error && typeof description === 'string' ? (
                            <FieldDescription>{description}</FieldDescription>
                        ) : null}
                        {error ? (
                            <FieldError id={errorId}>{error}</FieldError>
                        ) : null}
                    </Field>
                );
            })}
        </div>
    );
}
