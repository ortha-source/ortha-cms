import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Filter, Search } from 'lucide-react';
import {
    Badge,
    Button,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Spinner
} from '@ortha-cms/design-system';
import {
    QueryBuilder,
    countRules,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import { useContentSchema } from '../../../../../api/useContentSchema';
import {
    useRelationCandidates,
    type RelationCandidate
} from '../../../../../api/useRelationCandidates';
import { filterFieldsFromSchema } from '../../../../../utils/filterFieldsFromSchema';

const messages = defineMessages({
    title: {
        id: 'content.relations.picker.title',
        defaultMessage: 'Assign {label}'
    },
    descriptionMany: {
        id: 'content.relations.picker.descriptionMany',
        defaultMessage: 'Search, filter, and select records to link.'
    },
    descriptionSingle: {
        id: 'content.relations.picker.descriptionSingle',
        defaultMessage: 'Search and pick a record to link.'
    },
    search: {
        id: 'content.relations.picker.search',
        defaultMessage: 'Search {label}…'
    },
    filters: {
        id: 'content.relations.picker.filters',
        defaultMessage: 'Filters'
    },
    filtersCount: {
        id: 'content.relations.picker.filtersCount',
        defaultMessage: 'Filters ({count})'
    },
    clearFilters: {
        id: 'content.relations.picker.clearFilters',
        defaultMessage: 'Clear filters'
    },
    loading: {
        id: 'content.relations.picker.loading',
        defaultMessage: 'Loading…'
    },
    empty: {
        id: 'content.relations.picker.empty',
        defaultMessage: 'No records to choose from.'
    },
    noMatches: {
        id: 'content.relations.picker.noMatches',
        defaultMessage: 'No records match your search.'
    },
    count: {
        id: 'content.relations.picker.count',
        defaultMessage: '{total, plural, one {# record} other {# records}}'
    },
    selectedCount: {
        id: 'content.relations.picker.selectedCount',
        defaultMessage: '{count} selected'
    },
    cancel: { id: 'content.relations.picker.cancel', defaultMessage: 'Cancel' },
    add: {
        id: 'content.relations.picker.add',
        defaultMessage: 'Add {count}'
    }
});

/** How many rows to reveal per lazy-scroll step. */
const PAGE_SIZE = 12;
/** Simulated latency for a lazy-load step, so the spinner is visible (mock only). */
const LAZY_DELAY_MS = 350;

/** Short id suffix shown as a row's secondary line, e.g. `tag · b2e3d4c5`. */
function meta(targetName: string, id: string): string {
    return `${targetName} · ${id.slice(0, 8)}`;
}

/**
 * The relation picker dialog: a search box, an **inline** (collapsible)
 * query-builder filter over the **target type's** real schema, and a lazily
 * loaded, scrollable candidate list (checkbox rows for a many-relation,
 * click-to-pick for a single relation) that reveals more rows as the user
 * scrolls. The filter is a disclosure *inside this one dialog* — not a second
 * modal/drawer over it — so focus stays in a single overlay (a nested modal is a
 * known a11y hazard). Candidate records are mocked (`useRelationCandidates`); the
 * schema and the filter surface are real. The dialog stages its selection and
 * only commits on **Add** (many) or on click (single), so closing discards edits.
 */
export function RelationPickerDialog({
    open,
    onOpenChange,
    targetName,
    targetLabel,
    many,
    selectedIds,
    onConfirm
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetName: string;
    /** Human label of the target type, for the title and search placeholder. */
    targetLabel: string;
    many: boolean;
    /** The ids already assigned, used to pre-check rows. */
    selectedIds: string[];
    /** Commit a new id set (single → one id; many → the chosen set). */
    onConfirm: (ids: string[]) => void;
}) {
    const intl = useIntl();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterGroup | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [loadingMore, setLoadingMore] = useState(false);
    const [draft, setDraft] = useState<Set<string>>(new Set());

    const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    );

    // Re-seed the staged selection (and reset search/filter/window) each time the
    // dialog opens, so a close-without-commit discards edits.
    useEffect(() => {
        if (open) {
            setDraft(new Set(selectedIds));
            setSearch('');
            setFilter(null);
            setFiltersOpen(false);
            setLimit(PAGE_SIZE);
            setLoadingMore(false);
        }
    }, [open, selectedIds]);

    // Clear any in-flight lazy-load timer on unmount.
    useEffect(() => () => clearTimeout(loadTimer.current), []);

    const { data: schema, isPending } = useContentSchema(targetName, open);
    const filterFields = useMemo(
        () => (schema ? filterFieldsFromSchema(schema) : []),
        [schema]
    );

    const { items, total, hasMore } = useRelationCandidates(
        targetName,
        schema?.fields ?? [],
        filterFields,
        { search, filter, limit }
    );

    // Lazy infinite scroll: reveal the next window when the list scrolls near
    // its end, after a short (simulated) delay so the spinner is visible.
    const loadMore = () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        loadTimer.current = setTimeout(() => {
            setLimit((current) => current + PAGE_SIZE);
            setLoadingMore(false);
        }, LAZY_DELAY_MS);
    };

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= 120) {
            loadMore();
        }
    };

    const narrow = (apply: () => void) => {
        // Any new search/filter starts the window over from the top.
        clearTimeout(loadTimer.current);
        setLoadingMore(false);
        setLimit(PAGE_SIZE);
        apply();
    };

    const ruleCount = countRules(filter);
    const filtersActive = !!search.trim() || ruleCount > 0;

    const pick = (candidate: RelationCandidate) => {
        if (many) {
            setDraft((current) => {
                const next = new Set(current);
                if (next.has(candidate.id)) next.delete(candidate.id);
                else next.add(candidate.id);
                return next;
            });
        } else {
            onConfirm([candidate.id]);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] max-w-2xl gap-4">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            label: targetLabel
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(
                            many
                                ? messages.descriptionMany
                                : messages.descriptionSingle
                        )}
                    </DialogDescription>
                </DialogHeader>

                {/* Search + an inline (disclosure) filter — one overlay, no
                    nested drawer/modal over the dialog. */}
                <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    narrow(() => setSearch(event.target.value))
                                }
                                className="pl-8 shadow-none"
                                aria-label={intl.formatMessage(
                                    messages.search,
                                    {
                                        label: targetLabel
                                    }
                                )}
                                placeholder={intl.formatMessage(
                                    messages.search,
                                    { label: targetLabel }
                                )}
                            />
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                className="shrink-0 shadow-none"
                                disabled={filterFields.length === 0}
                            >
                                <Filter className="size-4" />
                                {ruleCount > 0
                                    ? intl.formatMessage(
                                          messages.filtersCount,
                                          {
                                              count: ruleCount
                                          }
                                      )
                                    : intl.formatMessage(messages.filters)}
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                        <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
                            <QueryBuilder
                                fields={filterFields}
                                value={filter}
                                onChange={(next) =>
                                    narrow(() => setFilter(next))
                                }
                            />
                            {ruleCount > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="self-start"
                                    onClick={() =>
                                        narrow(() => setFilter(null))
                                    }
                                >
                                    {intl.formatMessage(messages.clearFilters)}
                                </Button>
                            ) : null}
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {/* Result count / selection summary */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{intl.formatMessage(messages.count, { total })}</span>
                    {many && draft.size > 0 ? (
                        <span className="font-medium text-foreground">
                            {intl.formatMessage(messages.selectedCount, {
                                count: draft.size
                            })}
                        </span>
                    ) : null}
                </div>

                <div
                    onScroll={handleScroll}
                    className="flex h-64 flex-col overflow-y-auto rounded-lg border"
                    aria-busy={isPending || loadingMore}
                >
                    {isPending ? (
                        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Spinner className="size-4" />
                            {intl.formatMessage(messages.loading)}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                            {intl.formatMessage(
                                filtersActive
                                    ? messages.noMatches
                                    : messages.empty
                            )}
                        </p>
                    ) : (
                        <>
                            <div
                                className="divide-y"
                                role={many ? 'group' : 'radiogroup'}
                                aria-label={targetLabel}
                            >
                                {items.map((candidate) => {
                                    const checked = draft.has(candidate.id);
                                    const isSelected =
                                        !many &&
                                        selectedIds[0] === candidate.id;
                                    const active = many ? checked : isSelected;
                                    return (
                                        <label
                                            key={candidate.id}
                                            className={`flex cursor-pointer items-center gap-3 border-l-2 px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring ${
                                                active
                                                    ? 'border-l-primary bg-primary/5'
                                                    : 'border-l-transparent hover:bg-accent'
                                            }`}
                                        >
                                            {many ? (
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() =>
                                                        pick(candidate)
                                                    }
                                                />
                                            ) : (
                                                <input
                                                    type="radio"
                                                    name="relation-candidate"
                                                    className="size-4 shrink-0 accent-primary"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        pick(candidate)
                                                    }
                                                />
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {candidate.title}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {meta(
                                                        targetName,
                                                        candidate.id
                                                    )}
                                                </span>
                                            </span>
                                            {candidate.status ? (
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 capitalize"
                                                >
                                                    {candidate.status}
                                                </Badge>
                                            ) : null}
                                        </label>
                                    );
                                })}
                            </div>
                            {/* Lazy-load spinner */}
                            {loadingMore ? (
                                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                                    <Spinner className="size-4" />
                                    {intl.formatMessage(messages.loading)}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>

                <DialogFooter className="flex-row items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    {many ? (
                        <Button
                            type="button"
                            onClick={() => {
                                onConfirm([...draft]);
                                onOpenChange(false);
                            }}
                        >
                            {intl.formatMessage(messages.add, {
                                count: draft.size
                            })}
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
