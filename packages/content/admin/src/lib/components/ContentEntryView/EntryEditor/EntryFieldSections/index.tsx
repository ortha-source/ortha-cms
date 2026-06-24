import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../../constants';
import type { EntryFormState } from '../../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../../EntryFieldInput';

const messages = defineMessages({
    detailsTitle: {
        id: 'content.form.section.detailsTitle',
        defaultMessage: 'Details'
    },
    detailsBody: {
        id: 'content.form.section.detailsBody',
        defaultMessage: 'The core fields for this record.'
    },
    contentTitle: {
        id: 'content.form.section.contentTitle',
        defaultMessage: 'Content'
    },
    contentBody: {
        id: 'content.form.section.contentBody',
        defaultMessage: 'Long-form text and structured data.'
    },
    optionsTitle: {
        id: 'content.form.section.optionsTitle',
        defaultMessage: 'Options'
    },
    optionsBody: {
        id: 'content.form.section.optionsBody',
        defaultMessage: 'Toggles and multi-choice selections.'
    }
});

/** A field group: which field types it holds, its copy, and its layout. */
type SectionDef = {
    key: string;
    title: MessageDescriptor;
    body: MessageDescriptor;
    types: ReadonlySet<string>;
    /** Short single-line controls flow into a 2-column grid; the rest stack. */
    grid: boolean;
};

/** The short, single-line scalar controls — laid out in a 2-column grid. */
const SHORT_TYPES = new Set<string>([
    CONTENT_FIELD_TYPE.Text,
    CONTENT_FIELD_TYPE.Number,
    CONTENT_FIELD_TYPE.Money,
    CONTENT_FIELD_TYPE.Date,
    CONTENT_FIELD_TYPE.Datetime,
    CONTENT_FIELD_TYPE.Select
]);

/** Wide controls — full-width, stacked. */
const LONG_TYPES = new Set<string>([
    CONTENT_FIELD_TYPE.RichText,
    CONTENT_FIELD_TYPE.Json
]);

/** Toggle / multi-choice controls. */
const CHOICE_TYPES = new Set<string>([
    CONTENT_FIELD_TYPE.Boolean,
    CONTENT_FIELD_TYPE.Multiselect
]);

const SECTIONS: SectionDef[] = [
    {
        key: 'details',
        title: messages.detailsTitle,
        body: messages.detailsBody,
        types: SHORT_TYPES,
        grid: true
    },
    {
        key: 'content',
        title: messages.contentTitle,
        body: messages.contentBody,
        types: LONG_TYPES,
        grid: false
    },
    {
        key: 'options',
        title: messages.optionsTitle,
        body: messages.optionsBody,
        types: CHOICE_TYPES,
        grid: false
    }
];

/**
 * The General tab body: the type's fields grouped by control shape into titled
 * {@link Card} sections — short scalars in a two-column grid ("Details"),
 * long-form text/JSON stacked ("Content"), and toggles/multi-choice ("Options").
 * Empty sections are dropped, so a type with only text fields shows one card.
 * Relation fields are handled by their own tab and excluded by the caller.
 */
export function EntryFieldSections({
    fields,
    form
}: {
    fields: ContentField[];
    form: EntryFormState;
}) {
    const intl = useIntl();

    return (
        <div className="flex flex-col gap-6">
            {SECTIONS.map((section) => {
                const sectionFields = fields.filter((field) =>
                    section.types.has(field.type)
                );
                if (sectionFields.length === 0) return null;
                return (
                    <Card key={section.key} className="shadow-none">
                        <CardHeader>
                            <CardTitle className="text-base">
                                {intl.formatMessage(section.title)}
                            </CardTitle>
                            <CardDescription>
                                {intl.formatMessage(section.body)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent
                            className={
                                section.grid
                                    ? 'grid gap-x-4 gap-y-5 sm:grid-cols-2'
                                    : 'flex flex-col gap-5'
                            }
                        >
                            {sectionFields.map((field) => (
                                <EntryFieldInput
                                    key={field.name}
                                    field={field}
                                    value={form.values[field.name]}
                                    error={form.errorFor(field.name)}
                                    onChange={(value) =>
                                        form.setValue(field.name, value)
                                    }
                                    onBlur={() => form.touch(field.name)}
                                />
                            ))}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
