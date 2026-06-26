import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@ortha-cms/design-system';
import type {
    ContentField,
    ContentTypeDetail,
    EntryRecord
} from '../../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../constants';
import { useEntryForm } from '../../../hooks/useEntryForm';
import { EntryFieldInput } from '../../EntryFieldInput';
import { EntryFieldSections } from './EntryFieldSections';
import { EntrySidebar } from './EntrySidebar';

const messages = defineMessages({
    backToList: {
        id: 'content.editor.backToList',
        defaultMessage: 'Back to records'
    },
    tabGeneral: {
        id: 'content.editor.tabGeneral',
        defaultMessage: 'General'
    },
    tabRelations: {
        id: 'content.editor.tabRelations',
        defaultMessage: 'Relations'
    },
    tabMedia: { id: 'content.editor.tabMedia', defaultMessage: 'Media' },
    tabHistory: {
        id: 'content.editor.tabHistory',
        defaultMessage: 'History'
    },
    relationsTitle: {
        id: 'content.editor.relationsTitle',
        defaultMessage: 'Relations'
    },
    relationsBody: {
        id: 'content.editor.relationsBody',
        defaultMessage: 'Links from this record to other content.'
    },
    relationsEmpty: {
        id: 'content.editor.relationsEmpty',
        defaultMessage: 'This content type has no relation fields.'
    },
    mediaTitle: { id: 'content.editor.mediaTitle', defaultMessage: 'Media' },
    mediaBody: {
        id: 'content.editor.mediaBody',
        defaultMessage:
            'Image and file fields for this record will appear here once media support lands.'
    },
    historyTitle: {
        id: 'content.editor.historyTitle',
        defaultMessage: 'History'
    },
    historyBody: {
        id: 'content.editor.historyBody',
        defaultMessage:
            'A timeline of edits to this record will appear here soon.'
    }
});

/** Tab keys for the editor — named so they aren't bare string literals. */
const TAB = {
    General: 'general',
    Relations: 'relations',
    Media: 'media',
    History: 'history'
} as const;

/** A field is hidden when its admin hints say so. */
function isHidden(field: ContentField): boolean {
    return (field.admin as { hidden?: boolean }).hidden === true;
}

/**
 * The full entry editor: a title header, a tabbed body (**General** = grouped
 * field sections, **Relations** = relation fields, **Media** and **History** =
 * placeholders; all tabs always present), and a single monolithic right
 * {@link EntrySidebar} that owns the Save / Save&Publish / Cancel actions and a
 * collapsible details block. Owns the form state ({@link useEntryForm}) and the
 * `<form>`; persistence is the caller's `onSave`, called with the publish intent
 * so the same editor backs create / edit / single-page modes.
 */
export function EntryEditor({
    schema,
    initialValues,
    entry,
    isCreate,
    publishable,
    title,
    subtitle,
    saving,
    onSave,
    backTo
}: {
    schema: ContentTypeDetail;
    initialValues: Record<string, unknown>;
    entry?: EntryRecord;
    isCreate: boolean;
    publishable: boolean;
    title: string;
    subtitle?: string;
    saving: boolean;
    onSave: (
        values: Record<string, unknown>,
        options: { publish: boolean }
    ) => void;
    /** Where the "Back to records" link goes; omitted for a single page. */
    backTo?: string;
}) {
    const intl = useIntl();
    const form = useEntryForm(schema, initialValues);

    const visible = schema.fields.filter((field) => !isHidden(field));
    const generalFields = visible.filter(
        (field) => field.type !== CONTENT_FIELD_TYPE.Relation
    );
    const relationFields = visible.filter(
        (field) => field.type === CONTENT_FIELD_TYPE.Relation
    );

    const save = (publish: boolean) => () =>
        form.submit((values) => onSave(values, { publish }));

    return (
        <form
            noValidate
            className="flex min-h-0 flex-1 flex-col lg:flex-row"
            onSubmit={(event) => {
                event.preventDefault();
                // Submitting (e.g. Enter) runs the primary action — publish for
                // a publishable type, otherwise a plain save — so it matches the
                // visually-primary button rather than silently saving a draft.
                save(publishable)();
            }}
        >
            {/* Main column: title + tabs. The card itself is flush (no padding);
                padding lives here, inside the pane. `min-w-0` keeps wide field
                content from widening the page (the card scrolls as a whole). */}
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
                {backTo ? (
                    <Link
                        to={backTo}
                        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        {intl.formatMessage(messages.backToList)}
                    </Link>
                ) : null}
                <div className="mb-6 min-w-0">
                    <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                        {title}
                    </h1>
                    {subtitle ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                <div className="min-w-0">
                    <Tabs defaultValue={TAB.General}>
                        <TabsList className="mb-4">
                            <TabsTrigger value={TAB.General}>
                                {intl.formatMessage(messages.tabGeneral)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.Relations}>
                                {intl.formatMessage(messages.tabRelations)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.Media}>
                                {intl.formatMessage(messages.tabMedia)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.History}>
                                {intl.formatMessage(messages.tabHistory)}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={TAB.General}>
                            <EntryFieldSections
                                fields={generalFields}
                                form={form}
                            />
                        </TabsContent>

                        <TabsContent value={TAB.Relations}>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {intl.formatMessage(
                                            messages.relationsTitle
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {intl.formatMessage(
                                            messages.relationsBody
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-5">
                                    {relationFields.length > 0 ? (
                                        relationFields.map((field) => (
                                            <EntryFieldInput
                                                key={field.name}
                                                field={field}
                                                value={form.values[field.name]}
                                                error={form.errorFor(
                                                    field.name
                                                )}
                                                onChange={(value) =>
                                                    form.setValue(
                                                        field.name,
                                                        value
                                                    )
                                                }
                                                onBlur={() =>
                                                    form.touch(field.name)
                                                }
                                            />
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            {intl.formatMessage(
                                                messages.relationsEmpty
                                            )}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value={TAB.Media}>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {intl.formatMessage(
                                            messages.mediaTitle
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {intl.formatMessage(messages.mediaBody)}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </TabsContent>

                        <TabsContent value={TAB.History}>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {intl.formatMessage(
                                            messages.historyTitle
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {intl.formatMessage(
                                            messages.historyBody
                                        )}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <EntrySidebar
                entry={entry}
                publishable={publishable}
                isCreate={isCreate}
                saving={saving}
                onSaveDraft={save(false)}
                onPublish={save(true)}
            />
        </form>
    );
}
