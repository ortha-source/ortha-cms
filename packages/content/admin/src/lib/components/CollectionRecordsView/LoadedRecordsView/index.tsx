import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft, Filter, Plus, Trash2 } from 'lucide-react';
import {
    QueryBuilderDrawer,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import { useTableUrlState } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    SearchToolbar
} from '@ortha-cms/design-system';
import type {
    ContentType,
    ContentTypeDetail
} from '../../../types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_SEGMENT,
    DEFAULT_PAGE_SIZE,
    NEW_SEGMENT,
    SEARCH_PARAM,
    SORT_PARAM,
    TRASH_SEGMENT
} from '../../../constants';
import { useContentEntries } from '../../../api/useContentEntries';
import { useEntryColumns } from '../../../hooks/useEntryColumns';
import { entryColumns } from '../../../utils/entryColumns';
import { filterFieldsFromSchema } from '../../../utils/filterFieldsFromSchema';
import { CollectionRecordsTable } from '../CollectionRecordsTable';
import { CollectionRecordsColumnPicker } from '../CollectionRecordsColumnPicker';
import { CollectionRecordsPagination } from '../CollectionRecordsPagination';
import { CollectionRecordsEmpty } from '../CollectionRecordsEmpty';
import { CollectionRecordsSkeleton } from '../CollectionRecordsSkeleton';
import { CollectionRecordsSelectionBar } from '../CollectionRecordsSelectionBar';
import { CollectionRecordsBulkActions } from '../CollectionRecordsBulkActions';

/** Intl descriptors for {@link LoadedRecordsView}, co-located. */
const messages = defineMessages({
    subtitle: {
        id: 'content.records.subtitle',
        defaultMessage:
            '{count, plural, one {# record} other {# records}} in this collection.'
    },
    add: { id: 'content.records.add', defaultMessage: 'Add record' },
    trashTitle: {
        id: 'content.records.trashTitle',
        defaultMessage: '{label} · Trash'
    },
    trashSubtitle: {
        id: 'content.records.trashSubtitle',
        defaultMessage:
            '{count, plural, one {# deleted record} other {# deleted records}}.'
    },
    viewTrash: { id: 'content.records.viewTrash', defaultMessage: 'Trash' },
    backToRecords: {
        id: 'content.records.backToRecords',
        defaultMessage: 'Back to records'
    },
    searchLabel: {
        id: 'content.records.searchLabel',
        defaultMessage: 'Search records'
    },
    searchPlaceholder: {
        id: 'content.records.searchPlaceholder',
        defaultMessage: 'Search records'
    },
    filters: {
        id: 'content.records.filters',
        defaultMessage: 'Filters{count, plural, =0 {} other { (#)}}'
    },
    loading: {
        id: 'content.records.loading',
        defaultMessage: 'Loading records…'
    },
    results: {
        id: 'content.records.results',
        defaultMessage:
            '{count, plural, one {# record} other {# records}} found.'
    },
    error: {
        id: 'content.records.error',
        defaultMessage: 'Couldn’t load this collection. Please try again.'
    },
    retry: { id: 'content.records.retry', defaultMessage: 'Retry' },
    selectionStatus: {
        id: 'content.records.selection.status',
        defaultMessage:
            '{count, plural, =0 {No rows selected.} one {# row selected.} other {# rows selected.}}'
    }
});

/**
 * The records table once the schema is loaded — split out so every
 * schema-dependent hook (columns, entries) runs with a defined schema from its
 * first render. Mirrors `MembersPage`: URL-as-source-of-truth for search/filter/
 * page (via `useTableUrlState`), a page-clamp after a narrowing change, and the
 * query-builder glue.
 */
export function LoadedRecordsView({
    type,
    schema,
    trashed = false
}: {
    type: ContentType;
    schema: ContentTypeDetail;
    /** Render the trash view (soft-deleted rows, restore/purge actions). */
    trashed?: boolean;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const typePath = `/workspaces/${workspace.id}/${CONTENT_SEGMENT}/${type.name}`;
    const canCreate = useHasPermission(CONTENT_CREATE);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const paranoid = schema.paranoid ?? false;
    const publishable = schema.publishable ?? false;

    const {
        searchParam,
        filterParam,
        page,
        pageSize,
        searchInput,
        setSearchInput,
        updateParams
    } = useTableUrlState({
        searchKey: SEARCH_PARAM,
        defaultPageSize: DEFAULT_PAGE_SIZE
    });

    // Sort lives in the URL too (`?sort=<columnId>` asc, `?sort=-<columnId>`
    // desc), beside the table state above. Clicking a header cycles
    // asc → desc → off (cleared).
    const [searchParams] = useSearchParams();
    const sortParam = searchParams.get(SORT_PARAM) ?? '';
    const sort = useMemo(() => {
        if (!sortParam) return null;
        const desc = sortParam.startsWith('-');
        const key = desc ? sortParam.slice(1) : sortParam;
        return key
            ? { key, dir: desc ? ('desc' as const) : ('asc' as const) }
            : null;
    }, [sortParam]);
    const handleSort = useCallback(
        (columnId: string) => {
            const next =
                !sort || sort.key !== columnId
                    ? columnId
                    : sort.dir === 'asc'
                      ? `-${columnId}`
                      : undefined;
            updateParams({ [SORT_PARAM]: next });
        },
        [sort, updateParams]
    );

    const { columns, defaults } = useMemo(() => entryColumns(schema), [schema]);
    const availableIds = useMemo(
        () => columns.map((column) => column.id),
        [columns]
    );
    const { isVisible, toggle, visible, reorder } = useEntryColumns(
        type.name,
        availableIds,
        defaults
    );
    // Render columns in the persisted visible order (reconcile() guarantees the
    // ids are available, so the lookup never misses).
    const columnById = useMemo(
        () => new Map(columns.map((column) => [column.id, column])),
        [columns]
    );
    const visibleColumns = useMemo(
        () =>
            visible
                .map((id) => columnById.get(id))
                .filter((column) => column !== undefined),
        [visible, columnById]
    );

    // Row selection — by id, persisting across paging; cleared via the bar.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggleRow = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);
    const setPageSelection = useCallback((ids: string[], select: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
                if (select) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    }, []);
    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    const filterFields = useMemo(
        () => filterFieldsFromSchema(schema),
        [schema]
    );
    const appliedFilter = useMemo(
        () => jsonFilterToTree(filterParam),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    const { data, isPending, isError, isPlaceholderData, refetch } =
        useContentEntries(schema, {
            search: searchParam || undefined,
            filter: filterParam || undefined,
            sort: sortParam || undefined,
            page,
            pageSize,
            deleted: trashed ? 'only' : undefined
        });

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // A narrowing search/filter can leave fewer pages than the current one; pull
    // `page` back so we never strand the user past the end (copied from
    // MembersPage). Guarded on `data` so a deep-linked `?page=N` survives the
    // first fetch, and on `!isPlaceholderData` so the clamp reads the freshly
    // fetched `total` — not the previous page's count that `keepPreviousData`
    // holds in `data` while the narrowed request is still in flight.
    useEffect(() => {
        if (data && !isPlaceholderData && page > pageCount) {
            updateParams(
                { page: pageCount > 1 ? String(pageCount) : undefined },
                false
            );
        }
    }, [data, isPlaceholderData, page, pageCount, updateParams]);

    const applyFilter = useCallback(
        (next: FilterGroup | null) => {
            updateParams({ filter: treeToJsonFilter(next) ?? undefined });
        },
        [updateParams]
    );

    const entries = data?.items ?? [];
    const hasFilters = searchInput.trim().length > 0 || ruleCount > 0;

    const clearFilters = () => {
        setSearchInput('');
        updateParams({ [SEARCH_PARAM]: undefined, filter: undefined });
    };

    const openCreate = () => navigate(`${typePath}/${NEW_SEGMENT}`);

    return (
        <Container className="max-w-none p-6 sm:p-6">
            <ContainerHeader
                title={
                    trashed
                        ? intl.formatMessage(messages.trashTitle, {
                              label: schema.label
                          })
                        : schema.label
                }
                subtitle={intl.formatMessage(
                    trashed ? messages.trashSubtitle : messages.subtitle,
                    { count: total }
                )}
                actions={
                    trashed ? (
                        <Button variant="outline" className="shadow-none" asChild>
                            <Link to={typePath}>
                                <ArrowLeft />
                                {intl.formatMessage(messages.backToRecords)}
                            </Link>
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            {paranoid && canDelete ? (
                                <Button
                                    variant="outline"
                                    className="shadow-none"
                                    asChild
                                >
                                    <Link to={`${typePath}/${TRASH_SEGMENT}`}>
                                        <Trash2 />
                                        {intl.formatMessage(messages.viewTrash)}
                                    </Link>
                                </Button>
                            ) : null}
                            {canCreate ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    {intl.formatMessage(messages.add)}
                                </Button>
                            ) : null}
                        </div>
                    )
                }
            />

            <SearchToolbar
                value={searchInput}
                onValueChange={setSearchInput}
                searchLabel={intl.formatMessage(messages.searchLabel)}
                searchPlaceholder={intl.formatMessage(
                    messages.searchPlaceholder
                )}
                actions={
                    <div className="flex items-center gap-2">
                        <CollectionRecordsColumnPicker
                            columns={columns}
                            visible={visible}
                            isVisible={isVisible}
                            onToggle={toggle}
                            onReorder={reorder}
                            visibleCount={visible.length}
                        />
                        <QueryBuilderDrawer
                            fields={filterFields}
                            value={appliedFilter}
                            onApply={applyFilter}
                            trigger={
                                <Button
                                    variant="outline"
                                    className="shadow-none"
                                >
                                    <Filter aria-hidden className="size-4" />
                                    {intl.formatMessage(messages.filters, {
                                        count: ruleCount
                                    })}
                                </Button>
                            }
                        />
                    </div>
                }
            />

            {/* Always-mounted live region so a search/filter/sort that updates
                the table without a navigation is actually announced — a region
                that first mounts already populated is not announced. Carries the
                loading cue and the result count (WCAG 4.1.3); the error path is
                announced by the Alert's role="alert" below. */}
            <p role="status" aria-live="polite" className="sr-only">
                {isPending
                    ? intl.formatMessage(messages.loading)
                    : isError
                      ? ''
                      : intl.formatMessage(messages.results, { count: total })}
            </p>

            {/* Persistent selection announcer — present from first render so the
                transition to "{n} selected" and back to "No rows selected" is
                announced; the visual SelectionBar mounts only when something is
                selected, so it can't carry this. */}
            <p role="status" aria-live="polite" className="sr-only">
                {intl.formatMessage(messages.selectionStatus, {
                    count: selectedIds.size
                })}
            </p>

            {isPending ? (
                <CollectionRecordsSkeleton />
            ) : isError ? (
                <Alert variant="destructive" role="alert" className="mt-4">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <span>{intl.formatMessage(messages.error)}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            onClick={() => refetch()}
                        >
                            {intl.formatMessage(messages.retry)}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : entries.length === 0 ? (
                <CollectionRecordsEmpty
                    filtered={hasFilters}
                    trashed={trashed}
                    onClear={clearFilters}
                    onAdd={trashed || !canCreate ? undefined : openCreate}
                />
            ) : (
                <>
                    {selectedIds.size > 0 && (
                        <CollectionRecordsSelectionBar
                            count={selectedIds.size}
                            onClear={clearSelection}
                            actions={
                                <CollectionRecordsBulkActions
                                    typeName={type.name}
                                    ids={[...selectedIds]}
                                    publishable={publishable}
                                    paranoid={paranoid}
                                    trashed={trashed}
                                    onDone={clearSelection}
                                />
                            }
                        />
                    )}
                    <CollectionRecordsTable
                        label={schema.label}
                        entries={entries}
                        columns={visibleColumns}
                        typePath={typePath}
                        typeName={type.name}
                        publishable={publishable}
                        paranoid={paranoid}
                        trashed={trashed}
                        selectedIds={selectedIds}
                        onToggleRow={toggleRow}
                        onTogglePage={setPageSelection}
                        sort={sort}
                        onSort={handleSort}
                    />
                    <CollectionRecordsPagination
                        page={page}
                        pageCount={pageCount}
                        pageSize={effectivePageSize}
                        total={total}
                        onPageChange={(next) =>
                            updateParams({ page: String(next) }, false)
                        }
                        onPageSizeChange={(next) =>
                            updateParams({ pageSize: String(next) })
                        }
                    />
                </>
            )}
        </Container>
    );
}
