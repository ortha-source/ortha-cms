import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import type { ContentType, EntryRecord } from '../../types/contentType';
import { CONTENT_SEGMENT } from '../../constants';
import { useContentSchema } from '../../api/useContentSchema';
import {
    useContentEntries,
    contentEntriesPrefix,
    type ContentEntriesResult
} from '../../api/useContentEntries';
import { useContentEntry } from '../../api/useContentEntry';
import { useSaveEntry } from '../../api/useSaveEntry';
import { useEntryStatusActions } from '../../api/useEntryStatusActions';
import {
    emptyEntryValues,
    mergeEntryValues
} from '../../utils/emptyEntryValues';
import { EntryEditor } from './EntryEditor';

const messages = defineMessages({
    newTitle: { id: 'content.entry.newTitle', defaultMessage: 'New {label}' },
    loadError: {
        id: 'content.entry.loadError',
        defaultMessage: 'Couldn’t load this entry. Please try again.'
    },
    retry: { id: 'content.entry.retry', defaultMessage: 'Retry' },
    savedCreate: {
        id: 'content.entry.savedCreate',
        defaultMessage: '{label} created.'
    },
    savedUpdate: {
        id: 'content.entry.savedUpdate',
        defaultMessage: 'Changes saved.'
    },
    savedPublish: {
        id: 'content.entry.savedPublish',
        defaultMessage: '{label} published.'
    },
    deleted: {
        id: 'content.entry.deleted',
        defaultMessage: '{label} deleted.'
    },
    actionError: {
        id: 'content.entry.actionError',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/** Which form to open: a blank create, an existing record, or a single page. */
export type EntryMode = 'create' | 'edit' | 'single';

/** The one-entry query params reused for `single` resolution. */
const ONE_ENTRY = { page: 1, pageSize: 1 } as const;

/**
 * Hosts the {@link EntryEditor} for all three modes:
 * - `create` (`/:type/new`) → a blank editor;
 * - `edit` (`/:type/:entryId`) → the record from `GET /content/:type/:id`, seeded
 *   instantly from the records-list cache when opened from the table;
 * - `single` (a page) → the type's one entry via the list endpoint, or a blank
 *   create when it has none.
 *
 * Saving persists via {@link useSaveEntry} (create/update); a publish chains the
 * dedicated publish endpoint ({@link useEntryStatusActions}) so it runs the same
 * validated path as the row/bulk publish. A 422 is handed back to the editor's
 * form as inline field errors (it rejects the `onSave` promise).
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

    // Seed edit mode from the records-list cache (the common "opened from the
    // table" path) so the form is instant, then refetch the canonical copy.
    const cachedEntry = useMemo(() => {
        if (mode !== 'edit' || !entryId) return undefined;
        const cached = queryClient.getQueriesData<ContentEntriesResult>({
            queryKey: contentEntriesPrefix(type.name)
        });
        for (const [, data] of cached) {
            const hit = data?.items.find((item) => item.id === entryId);
            if (hit) return hit;
        }
        return undefined;
    }, [mode, entryId, queryClient, type.name]);

    const entryQuery = useContentEntry(type.name, entryId, {
        initialData: cachedEntry,
        enabled: mode === 'edit'
    });

    const save = useSaveEntry(type.name);
    const status = useEntryStatusActions(type.name);

    // In create mode, remember the id returned by a successful create so that if
    // the chained publish (or a later save) fails, a retry **updates** that draft
    // instead of creating a second row.
    const [createdId, setCreatedId] = useState<string | undefined>(undefined);

    // The single page's existing row (if any).
    const singleEntry = oneEntryQuery.data?.items[0];
    const editEntry = entryQuery.data;

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
        const source = mode === 'edit' ? editEntry : singleEntry;
        if (source) {
            return {
                values: mergeEntryValues(schema, source.values),
                entry: source
            };
        }
        // A single page with no row yet falls back to a blank create form.
        return mode === 'single' ? { values: emptyEntryValues(schema) } : null;
    }, [schema, mode, editEntry, singleEntry]);

    const loading =
        schemaQuery.isPending ||
        (mode === 'single' && oneEntryQuery.isPending) ||
        (mode === 'edit' && entryQuery.isPending);
    const errored =
        schemaQuery.isError ||
        !schema ||
        (mode === 'single' && oneEntryQuery.isError) ||
        // Only fatal when there's no record to show — a background refetch
        // failure on a cache-seeded edit keeps the form usable.
        (mode === 'edit' && entryQuery.isError && !editEntry);

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

    if (errored || !schema || !resolved) {
        return (
            <Container className="max-w-none p-4 sm:p-6">
                <ContainerHeader title={schema?.label ?? type.label} />
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
                                if (mode === 'edit') entryQuery.refetch();
                            }}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </AlertDescription>
                </Alert>
            </Container>
        );
    }

    const isCreate = resolved.entry === undefined;
    const publishable = schema.publishable ?? false;
    const title =
        mode === 'create'
            ? intl.formatMessage(messages.newTitle, { label: schema.label })
            : schema.label;

    // Persist, then (optionally) publish. Rejects on a server error so the editor
    // can surface a 422's field issues; resolves on success after toast + nav.
    const onSave = async (
        values: Record<string, unknown>,
        options: { publish: boolean }
    ) => {
        // Reuse the id of an existing row, or one we already created this
        // session — so a save after a failed publish updates, never re-creates.
        const existingId = resolved.entry?.id ?? createdId;
        const saved = await save.mutateAsync({ id: existingId, values });
        // Record the new id before chaining publish: if publish then fails, the
        // draft persists and the user's retry must target it (not POST again).
        if (!existingId) setCreatedId(saved.id);
        const willPublish = options.publish && publishable;
        if (willPublish) {
            await status.publish.mutateAsync(saved.id);
        }
        toast(
            intl.formatMessage(
                willPublish
                    ? messages.savedPublish
                    : isCreate
                      ? messages.savedCreate
                      : messages.savedUpdate,
                { label: schema.label }
            )
        );
        // Collections return to the table; a single page stays put.
        if (mode !== 'single') navigate(typePath);
    };

    // Entry-level actions are available only when editing an existing collection
    // row (not on create, not on a single page).
    const editId = mode === 'edit' ? resolved.entry?.id : undefined;

    const onActionError = () =>
        toast(intl.formatMessage(messages.actionError));

    const onUnpublish =
        editId && publishable
            ? () => {
                  status.unpublish
                      .mutateAsync(editId)
                      .then(() => entryQuery.refetch())
                      .catch(onActionError);
              }
            : undefined;

    const onDelete = editId
        ? () => {
              status.remove
                  .mutateAsync(editId)
                  .then(() => {
                      toast(
                          intl.formatMessage(messages.deleted, {
                              label: schema.label
                          })
                      );
                      navigate(typePath);
                  })
                  .catch(onActionError);
          }
        : undefined;

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
                saving={save.isPending || status.publish.isPending}
                mutating={status.unpublish.isPending || status.remove.isPending}
                onSave={onSave}
                onUnpublish={onUnpublish}
                onDelete={onDelete}
                backTo={mode === 'single' ? undefined : typePath}
            />
        </div>
    );
}
