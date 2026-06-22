import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Filter, Plus } from 'lucide-react';
import {
    QueryBuilderDrawer,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import { useTableUrlState } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    SearchToolbar
} from '@ortha-cms/design-system';
import type { ContentType, ContentTypeDetail } from '../../types/contentType';
import {
    CONTENT_SEGMENT,
    DEFAULT_PAGE_SIZE,
    NEW_SEGMENT,
    SEARCH_PARAM,
    SORT_PARAM
} from '../../constants';
import { useContentSchema } from '../../api/useContentSchema';
import { useContentEntries } from '../../api/useContentEntries';
import { useEntryColumns } from '../../hooks/useEntryColumns';
import { entryColumns } from '../../utils/entryColumns';
import { filterFieldsFromSchema } from '../../utils/filterFieldsFromSchema';
import { CollectionRecordsTable } from './CollectionRecordsTable';
import { CollectionRecordsColumnPicker } from './CollectionRecordsColumnPicker';
import { CollectionRecordsPagination } from './CollectionRecordsPagination';
import { CollectionRecordsEmpty } from './CollectionRecordsEmpty';
import { CollectionRecordsSkeleton } from './CollectionRecordsSkeleton';
import { CollectionRecordsSelectionBar } from './CollectionRecordsSelectionBar';

/** Intl descriptors for {@link CollectionRecordsView}, co-located. */
const messages = defineMessages({
    subtitle: {
        id: 'content.records.subtitle',
        defaultMessage:
            '{count, plural, one {# record} other {# records}} in this collection.'
    },
    add: { id: 'content.records.add', defaultMessage: 'Add record' },
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
    results: {
        id: 'content.records.results',
        defaultMessage: '{count, plural, one {# record} other {# records}} found.'
    },
    error: {
        id: 'content.records.error',
        defaultMessage: 'Couldn’t load this collection. Please try again.'
    },
    retry: { id: 'content.records.retry', defaultMessage: 'Retry' }
});

/**
 * The records experience for a collection: a searchable, filterable, paginated,
 * deep-linkable table of its entries, with a column picker and an "Add record"
 * action. It loads the type's full field schema, then the entries page from
 * `GET /api/content/:name` (search/filter/sort/paginate happen server-side).
 * Loading/error states stand in while the schema resolves; the table itself
 * only mounts once the schema is known, so columns seed correctly on first render.
 */
export function CollectionRecordsView({ type }: { type: ContentType }) {
    const intl = useIntl();
    const {
        data: schema,
        isPending,
        isError,
        refetch
    } = useContentSchema(type.name);

    if (isPending) {
        return (
            <Container className="max-w-none p-4 sm:p-4">
                <ContainerHeader title={type.label} />
                <CollectionRecordsSkeleton />
            </Container>
        );
    }

    if (isError || !schema) {
        return (
            <Container className="max-w-none p-4 sm:p-4">
                <ContainerHeader title={type.label} />
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
            </Container>
        );
    }

    return <LoadedRecordsView type={type} schema={schema} />;
}

/**
 * The records table once the schema is loaded — split out so every
 * schema-dependent hook (columns, entries) runs with a defined schema from its
 * first render. Mirrors `MembersPage`: URL-as-source-of-truth for search/filter/
 * page (via `useTableUrlState`), a page-clamp after a narrowing change, and the
 * query-builder glue.
 */
function LoadedRecordsView({
    type,
    schema
}: {
    type: ContentType;
    schema: ContentTypeDetail;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const workspace = useCurrentWorkspace();
    const typePath = `/workspaces/${workspace.id}/${CONTENT_SEGMENT}/${type.name}`;

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
        return key ? { key, dir: desc ? ('desc' as const) : ('asc' as const) } : null;
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

    const { columns, defaults } = useMemo(
        () => entryColumns(schema),
        [schema]
    );
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

    const { data, isPending, isError, refetch } = useContentEntries(schema, {
        search: searchParam || undefined,
        filter: filterParam || undefined,
        sort: sortParam || undefined,
        page,
        pageSize
    });

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // A narrowing search/filter can leave fewer pages than the current one; pull
    // `page` back so we never strand the user past the end (copied from
    // MembersPage). Guarded on `data` so a deep-linked `?page=N` survives the
    // first fetch.
    useEffect(() => {
        if (data && page > pageCount) {
            updateParams(
                { page: pageCount > 1 ? String(pageCount) : undefined },
                false
            );
        }
    }, [data, page, pageCount, updateParams]);

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
        <Container className="max-w-none p-4 sm:p-4">
            <ContainerHeader
                title={schema.label}
                subtitle={intl.formatMessage(messages.subtitle, {
                    count: total
                })}
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        {intl.formatMessage(messages.add)}
                    </Button>
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

            {/* Announce the result count to assistive tech after a search or
                filter changes the table without a navigation (WCAG 4.1.3). */}
            {!isPending && !isError && (
                <p role="status" aria-live="polite" className="sr-only">
                    {intl.formatMessage(messages.results, { count: total })}
                </p>
            )}

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
                    onClear={clearFilters}
                    onAdd={openCreate}
                />
            ) : (
                <>
                    {selectedIds.size > 0 && (
                        <CollectionRecordsSelectionBar
                            count={selectedIds.size}
                            onClear={clearSelection}
                        />
                    )}
                    <CollectionRecordsTable
                        label={schema.label}
                        entries={entries}
                        columns={visibleColumns}
                        typePath={typePath}
                        publishable={schema.publishable ?? false}
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
