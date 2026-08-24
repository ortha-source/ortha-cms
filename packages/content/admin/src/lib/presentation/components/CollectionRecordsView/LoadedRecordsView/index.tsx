import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowLeft, ChevronDown, Filter, Plus, Trash2 } from 'lucide-react';
import {
    QueryBuilderPanel,
    QueryBuilderSummary,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import { useTableUrlState } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    SearchToolbar,
    cn
} from '@orthacms/design-system';
import type {
    ContentType,
    ContentTypeDetail
} from '../../../../domain/types/contentType';
import {
    COLUMN_KIND,
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_FIELD_TYPE,
    CONTENT_SEGMENT,
    DEFAULT_PAGE_SIZE,
    NEW_SEGMENT,
    SEARCH_PARAM,
    SORT_PARAM,
    TRASH_SEGMENT
} from '../../../../domain/constants';
import { useContentEntries } from '../../../../application/useContentEntries';
import { useEntryColumns } from '../../../hooks/useEntryColumns';
import { useColumnLabel } from '../../../hooks/useColumnLabel';
import { useSlotListParams } from '../../../hooks/useSlotListParams';
import { entryColumns } from '../../../../domain/entryColumns';
import { listParamsQuery } from '../../../../domain/listParamsQuery';
import { useFilterFields } from '../../../../application/useFilterFields';
import { RelationValuePicker } from '../../RelationValuePicker';
import {
    RECORDS_COLUMN_SLOT,
    RECORDS_FILTER_FIELDS_SLOT,
    RECORDS_TOOLBAR_SLOT
} from '../../../slots/contentSlots';
import { CollectionRecordsTable } from '../CollectionRecordsTable';
import { CollectionRecordsColumnPicker } from '../CollectionRecordsColumnPicker';
import {
    CollectionRecordsPagination,
    PAGE_SIZE_OPTIONS
} from '../CollectionRecordsPagination';
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
        defaultMessage: 'Filters{count, plural, =0 {} other { · #}}'
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
    },
    viewStatus: {
        id: 'content.records.viewStatus',
        defaultMessage:
            'Showing {from}–{to} of {total}, page {page} of {pageCount}.'
    },
    sortStatus: {
        id: 'content.records.sortStatus',
        defaultMessage:
            'Sorted by {column}, {direction, select, desc {descending} other {ascending}}.'
    },
    sortNone: {
        id: 'content.records.sortNone',
        defaultMessage: 'Not sorted.'
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
        pageSize: pageSizeParam,
        searchInput,
        searchPending,
        setSearchInput,
        updateParams
    } = useTableUrlState({
        searchKey: SEARCH_PARAM,
        defaultPageSize: DEFAULT_PAGE_SIZE
    });

    // `pageSize` comes from the URL, so it can be anything — and the server
    // rejects anything over its own cap with a **400**, not a clamp. Left
    // unchecked, `?pageSize=999` rendered the collection's error card with no
    // way back: Retry re-sends the same parameter, and the rows-per-page select
    // only exists inside a footer that needs rows to render. Narrow it to the
    // sizes this table actually offers, so a hand-edited or stale link
    // degrades to the default instead of stranding the reader.
    const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam)
        ? pageSizeParam
        : DEFAULT_PAGE_SIZE;

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

    // Slot-contributed toolbar items and their URL-owned list params (e.g. the
    // i18n plugin's `?locale=`). The values are forwarded to the list request
    // verbatim and ride the query key. Slot items are boot-frozen, so reading
    // them during render is stable.
    const toolbarItems = RECORDS_TOOLBAR_SLOT.getItems();
    const slotParamKeys = useMemo(
        () => toolbarItems.flatMap((item) => item.listParamKeys ?? []),
        [toolbarItems]
    );
    const slotParams = useSlotListParams(slotParamKeys);

    const extensionColumnItems = RECORDS_COLUMN_SLOT.getItems();
    const { columns, defaults } = useMemo(
        () => entryColumns(schema, extensionColumnItems),
        [schema, extensionColumnItems]
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
    // A single-row delete/purge/restore takes the row out of this view, but the
    // selection is keyed by id and spans pages, so nothing was dropping it: the
    // bar kept counting a record that no longer exists, and a later bulk action
    // still submitted its id (the server's dry run answered "No longer
    // available" beside a raw uuid). Drop it at the source instead.
    const forgetRow = useCallback((id: string) => {
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    // Server-derived filter surface (scalar fields + recursive relation paths),
    // replacing the old client-side `filterFieldsFromSchema` mirror. Its load
    // state is threaded into the panel: with no field definitions every rule
    // fails the Apply gate, so an empty picker would read as a dead button.
    const {
        fields: schemaFilterFields,
        isPending: filterFieldsPending,
        isError: filterFieldsError,
        refetch: refetchFilterFields
    } = useFilterFields(schema.name);
    // Slot-contributed filter fields (e.g. locale aggregates), appended after
    // the schema-derived set. Hook-in-a-loop is rules-of-hooks-safe here:
    // slot items are registered once at boot and never change, so the call
    // order is stable across renders (see the slot module's JSDoc).
    const slotFilterFields = RECORDS_FILTER_FIELDS_SLOT.getItems().flatMap(
        (item) => item.useFields(schema)
    );
    const filterFields = [...schemaFilterFields, ...slotFilterFields];
    const appliedFilter = useMemo(
        () => jsonFilterToTree(filterParam),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    // Ask the server to expand only the relation columns actually on screen, so
    // hiding one stops it being resolved. Empty when no relation column is
    // visible — the list then carries no relation cost at all.
    const relationFields = useMemo(
        () =>
            visibleColumns
                .filter(
                    (column) =>
                        column.kind === COLUMN_KIND.Field &&
                        column.field.type === CONTENT_FIELD_TYPE.Relation
                )
                .map((column) => column.id)
                // Sorted so a pure reorder doesn't mint a new query key: the
                // server resolves a *set* of fields, and display order is not
                // part of that request. Unsorted, dragging one relation column
                // past another would refetch the whole page for a visual change.
                .sort()
                .join(','),
        [visibleColumns]
    );

    // `keepPreviousData` means a narrowing change leaves the *old* rows on
    // screen while the new request is in flight — correct for typing (no
    // flicker per keystroke), but with no cue at all for the deliberate
    // actions. So Apply and a page change each raise a flag that swaps the
    // table for its skeleton until the request settles.
    const [applying, setApplying] = useState(false);
    const [paging, setPaging] = useState(false);
    const { data, isPending, isFetching, isError, isPlaceholderData, refetch } =
        useContentEntries(schema, {
            search: searchParam || undefined,
            filter: filterParam || undefined,
            sort: sortParam || undefined,
            page,
            pageSize,
            deleted: trashed ? 'only' : undefined,
            ...(relationFields
                ? { relations: 'preview' as const, relationFields }
                : {}),
            ...(slotParamKeys.length ? { extra: slotParams } : {})
        });

    // Clear either skeleton once its request has settled.
    useEffect(() => {
        if (isFetching) return;
        if (applying) setApplying(false);
        if (paging) setPaging(false);
    }, [applying, paging, isFetching]);

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // Sorting and paging used to change the table in total silence: the live
    // region's only content was the **total**, which is exactly what neither
    // action changes (WCAG 4.1.3). Restate the view instead — which slice is on
    // screen, and what it is ordered by — so a header click or a Next press is
    // distinguishable from a click that did nothing.
    const viewStatus = intl.formatMessage(messages.viewStatus, {
        from: total === 0 ? 0 : (page - 1) * effectivePageSize + 1,
        to: Math.min(page * effectivePageSize, total),
        total,
        page,
        pageCount
    });
    const columnLabel = useColumnLabel();
    const sortedColumn = sort
        ? visibleColumns.find((column) => column.id === sort.key)
        : undefined;
    const sortStatus = sortedColumn
        ? intl.formatMessage(messages.sortStatus, {
              column: columnLabel(sortedColumn),
              direction: sort?.dir ?? 'asc'
          })
        : intl.formatMessage(messages.sortNone);

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

    // The inline filter panel: its own open state (the toolbar button toggles
    // it), with the ids wiring the button's `aria-controls` to the region.
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filtersPanelId = useId();
    const filtersToggleId = useId();
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    // Return focus to the toggle when the panel collapses (Apply / Esc), so the
    // now-`inert` panel doesn't strand focus on the body.
    const setFiltersPanelOpen = useCallback((open: boolean) => {
        setFiltersOpen(open);
        if (!open) filtersToggleRef.current?.focus();
    }, []);

    const entries = data?.items ?? [];
    const hasFilters = searchInput.trim().length > 0 || ruleCount > 0;

    // Per-page data for the extension columns: every registered item's
    // `useRowsData` runs on every render (boot-frozen items → stable hook
    // order; items gate their own fetching internally), keyed by item id for
    // the table's cells.
    //
    // Whether the column is switched on is passed **in** rather than used to
    // skip the call — skipping would change hook order between renders. Every
    // extension column is off by default, so an item that ignores this fetches
    // for a column that is never drawn.
    const extensionData: Record<string, unknown> = {};
    for (const item of extensionColumnItems) {
        extensionData[item.id] = item.useRowsData?.(
            entries,
            schema,
            workspace.id,
            isVisible(item.id)
        );
    }

    const clearFilters = () => {
        setSearchInput('');
        updateParams({ [SEARCH_PARAM]: undefined, filter: undefined });
    };

    // The slot-owned URL params (e.g. the active locale) as a query suffix, so
    // every link out of the table keeps the context the table was showing — the
    // create route below and each row's editor link (passed to the table), whose
    // editor in turn carries it back on "Back to records".
    const entryQuery = listParamsQuery(slotParams);

    const openCreate = () => {
        navigate(`${typePath}/${NEW_SEGMENT}${entryQuery}`);
    };

    return (
        <Container className="max-w-none p-6 sm:p-6">
            <ContainerHeader
                titleClassName="text-lg"
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
                        <Button
                            variant="outline"
                            className="shadow-none"
                            asChild
                        >
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
                busy={searchPending || (isFetching && !isPending)}
                searchLabel={intl.formatMessage(messages.searchLabel)}
                searchPlaceholder={intl.formatMessage(
                    messages.searchPlaceholder
                )}
                actions={
                    <div className="flex items-center gap-2">
                        {toolbarItems.map((item) => (
                            <item.Component
                                key={item.id}
                                schema={schema}
                                workspaceId={workspace.id}
                                params={slotParams}
                                updateParams={updateParams}
                            />
                        ))}
                        <CollectionRecordsColumnPicker
                            columns={columns}
                            visible={visible}
                            isVisible={isVisible}
                            onToggle={toggle}
                            onReorder={reorder}
                            visibleCount={visible.length}
                        />
                        <Button
                            ref={filtersToggleRef}
                            id={filtersToggleId}
                            variant="outline"
                            className="shadow-none"
                            aria-expanded={filtersOpen}
                            aria-controls={filtersPanelId}
                            onClick={() => setFiltersPanelOpen(!filtersOpen)}
                        >
                            <Filter aria-hidden className="size-4" />
                            {intl.formatMessage(messages.filters, {
                                count: ruleCount
                            })}
                            <ChevronDown
                                aria-hidden
                                className={cn(
                                    'size-4 transition-transform duration-150 motion-reduce:transition-none',
                                    filtersOpen && 'rotate-180'
                                )}
                            />
                        </Button>
                    </div>
                }
            />

            {/* The filter builder, inline between the toolbar and the table. It
                pushes the table down when open (no overlay); collapsed with
                active filters, the applied conditions read out as removable
                chips below. */}
            <QueryBuilderPanel
                id={filtersPanelId}
                labelledBy={filtersToggleId}
                open={filtersOpen}
                onOpenChange={setFiltersPanelOpen}
                fields={filterFields}
                value={appliedFilter}
                onApply={applyFilter}
                onApplied={() => setApplying(true)}
                fieldsPending={filterFieldsPending}
                fieldsError={filterFieldsError}
                onRetryFields={refetchFilterFields}
                renderRelationValue={(props) => (
                    <RelationValuePicker {...props} />
                )}
            />
            {!filtersOpen && appliedFilter && ruleCount > 0 ? (
                <QueryBuilderSummary
                    className="mb-4"
                    tree={appliedFilter}
                    fields={filterFields}
                    onChange={applyFilter}
                />
            ) : null}

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
                      : `${intl.formatMessage(messages.results, {
                            count: total
                        })} ${viewStatus} ${sortStatus}`}
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

            {isPending || ((applying || paging) && isFetching) ? (
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
                                    schema={schema}
                                    workspaceId={workspace.id}
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
                        extensionData={extensionData}
                        typePath={typePath}
                        entryQuery={entryQuery}
                        typeName={type.name}
                        workspaceId={workspace.id}
                        publishable={publishable}
                        paranoid={paranoid}
                        trashed={trashed}
                        selectedIds={selectedIds}
                        onToggleRow={toggleRow}
                        onTogglePage={setPageSelection}
                        onRowGone={forgetRow}
                        sort={sort}
                        onSort={handleSort}
                        relationsPending={isPlaceholderData}
                    />
                    <CollectionRecordsPagination
                        page={page}
                        pageCount={pageCount}
                        pageSize={effectivePageSize}
                        total={total}
                        onPageChange={(next) => {
                            setPaging(true);
                            updateParams({ page: String(next) }, false);
                        }}
                        onPageSizeChange={(next) => {
                            setPaging(true);
                            updateParams({ pageSize: String(next) });
                        }}
                    />
                </>
            )}
        </Container>
    );
}
