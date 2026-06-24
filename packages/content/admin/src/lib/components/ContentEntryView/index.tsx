import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { FileQuestion } from 'lucide-react';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import type { ContentType, EntryRecord } from '../../types/contentType';
import { CONTENT_SEGMENT } from '../../constants';
import { useContentSchema } from '../../api/useContentSchema';
import {
    useContentEntries,
    type ContentEntriesResult
} from '../../api/useContentEntries';
import { useSaveEntry } from '../../api/useSaveEntry';
import {
    emptyEntryValues,
    mergeEntryValues
} from '../../utils/emptyEntryValues';
import { EntryEditor } from './EntryEditor';

const messages = defineMessages({
    newTitle: { id: 'content.entry.newTitle', defaultMessage: 'New {label}' },
    loadError: {
        id: 'content.entry.loadError',
        defaultMessage: 'Couldn’t load this content type. Please try again.'
    },
    retry: { id: 'content.entry.retry', defaultMessage: 'Retry' },
    notFoundTitle: {
        id: 'content.entry.notFoundTitle',
        defaultMessage: 'Open this record from the list'
    },
    notFoundBody: {
        id: 'content.entry.notFoundBody',
        defaultMessage:
            'Loading a single record directly isn’t available yet — open it from the records table for now.'
    },
    backToList: {
        id: 'content.entry.backToList',
        defaultMessage: 'Back to records'
    },
    savedCreate: {
        id: 'content.entry.savedCreate',
        defaultMessage:
            '{label} created (not yet persisted — save API pending).'
    },
    savedUpdate: {
        id: 'content.entry.savedUpdate',
        defaultMessage: 'Changes saved (not yet persisted — save API pending).'
    },
    savedPublish: {
        id: 'content.entry.savedPublish',
        defaultMessage: 'Published (not yet persisted — save API pending).'
    }
});

/** Which form to open: a blank create, an existing record, or a single page. */
export type EntryMode = 'create' | 'edit' | 'single';

/** The one-entry query params reused for `single` resolution. */
const ONE_ENTRY = { page: 1, pageSize: 1 } as const;

/**
 * Hosts the {@link EntryEditor} for all three modes:
 * - `create` (`/:type/new`) → a blank editor;
 * - `edit` (`/:type/:entryId`) → the record's values + metadata, sourced from
 *   the records list cache (the common path: opened from the table). A cache
 *   miss (deep link / reload) shows a notice, since there's no read-one API yet;
 * - `single` (a page) → the type's one entry via the list endpoint, or a blank
 *   create when it has none.
 *
 * Saving is mocked ({@link useSaveEntry}) per this milestone — it toasts and
 * navigates but doesn't persist.
 */
export function ContentEntryView({
    type,
    mode,
    entryId
}: {
    type: ContentType;
    mode: EntryMode;
    entryId?: string;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const queryClient = useQueryClient();
    const typePath = `/workspaces/${workspace.id}/${CONTENT_SEGMENT}/${type.name}`;

    const schemaQuery = useContentSchema(type.name);
    const schema = schemaQuery.data;

    // `single` resolves its one row via the list endpoint; other modes don't fetch.
    const oneEntryQuery = useContentEntries(
        schema,
        ONE_ENTRY,
        mode === 'single' && !!schema
    );

    const save = useSaveEntry(type.name);

    // The record being edited, if it's already in the records-list cache.
    const cachedEntry = useMemo(() => {
        if (mode !== 'edit' || !entryId) return undefined;
        const cached = queryClient.getQueriesData<ContentEntriesResult>({
            queryKey: ['content-entries', type.name]
        });
        for (const [, data] of cached) {
            const hit = data?.items.find((item) => item.id === entryId);
            if (hit) return hit;
        }
        return undefined;
    }, [mode, entryId, queryClient, type.name]);

    // The single page's existing row (if any).
    const singleEntry = oneEntryQuery.data?.items[0];

    // Resolve the editor's initial values, the source record (for metadata), and
    // the id we'd update — memoized so the form re-seeds only on identity change.
    const resolved = useMemo((): {
        values: Record<string, unknown>;
        entry?: EntryRecord;
    } | null => {
        if (!schema) return null;
        if (mode === 'create') {
            return { values: emptyEntryValues(schema) };
        }
        const source = mode === 'edit' ? cachedEntry : singleEntry;
        if (source) {
            return {
                values: mergeEntryValues(schema, source.values),
                entry: source
            };
        }
        // A single page with no row yet falls back to a blank create form;
        // edit with no cached record is a miss (handled below).
        return mode === 'single' ? { values: emptyEntryValues(schema) } : null;
    }, [schema, mode, cachedEntry, singleEntry]);

    const loading =
        schemaQuery.isPending || (mode === 'single' && oneEntryQuery.isPending);
    const errored =
        schemaQuery.isError ||
        !schema ||
        (mode === 'single' && oneEntryQuery.isError);

    if (loading) {
        return (
            <Container className="max-w-none p-4 sm:p-6">
                <ContainerHeader title={type.label} />
                <div className="mt-8 flex justify-center">
                    <Spinner aria-hidden />
                </div>
            </Container>
        );
    }

    if (errored || !schema) {
        return (
            <Container className="max-w-none p-4 sm:p-6">
                <ContainerHeader title={type.label} />
                <Alert variant="destructive" role="alert" className="mt-4">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <span>{intl.formatMessage(messages.loadError)}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            onClick={() => {
                                schemaQuery.refetch();
                                if (mode === 'single') oneEntryQuery.refetch();
                            }}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </AlertDescription>
                </Alert>
            </Container>
        );
    }

    // Edit deep-link with no cached record — no read-one API yet.
    if (!resolved) {
        return (
            <Container className="max-w-none p-4 sm:p-6">
                <ContainerHeader title={schema.label} />
                <Empty className="mt-6">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FileQuestion />
                        </EmptyMedia>
                        <EmptyTitle>
                            {intl.formatMessage(messages.notFoundTitle)}
                        </EmptyTitle>
                        <EmptyDescription>
                            {intl.formatMessage(messages.notFoundBody)}
                        </EmptyDescription>
                    </EmptyHeader>
                    <Button
                        variant="outline"
                        onClick={() => navigate(typePath)}
                    >
                        {intl.formatMessage(messages.backToList)}
                    </Button>
                </Empty>
            </Container>
        );
    }

    const isCreate = resolved.entry === undefined;
    const publishable = schema.publishable ?? false;
    const title =
        mode === 'create'
            ? intl.formatMessage(messages.newTitle, { label: schema.label })
            : schema.label;

    const onSave = (
        values: Record<string, unknown>,
        options: { publish: boolean }
    ) => {
        save.mutate(
            { id: resolved.entry?.id, values },
            {
                onSuccess: () => {
                    toast(
                        intl.formatMessage(
                            options.publish
                                ? messages.savedPublish
                                : isCreate
                                  ? messages.savedCreate
                                  : messages.savedUpdate,
                            { label: schema.label }
                        )
                    );
                    // Collections return to the table; a single page stays put.
                    if (mode !== 'single') navigate(typePath);
                }
            }
        );
    };

    // A plain full-bleed wrapper (not the design-system `Container`, whose
    // `mx-auto`/`max-w-6xl` + responsive `sm:px-6 sm:py-8` padding would inset
    // the editor): the card is flush, padding lives inside each pane.
    return (
        <div className="flex min-h-full flex-col">
            <EntryEditor
                schema={schema}
                initialValues={resolved.values}
                entry={resolved.entry}
                isCreate={isCreate}
                publishable={publishable}
                title={title}
                subtitle={schema.description}
                saving={save.isPending}
                onSave={onSave}
                backTo={mode === 'single' ? undefined : typePath}
            />
        </div>
    );
}
