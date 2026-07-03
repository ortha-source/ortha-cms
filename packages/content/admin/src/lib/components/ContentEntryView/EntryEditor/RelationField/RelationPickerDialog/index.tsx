import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@ortha-cms/design-system';
import { countRules, type FilterGroup } from '@ortha-cms/query-builder-admin';
import { useContentSchema } from '../../../../../api/useContentSchema';
import {
    useRelationCandidates,
    MAX_CANDIDATE_WINDOW,
    type RelationCandidate
} from '../../../../../api/useRelationCandidates';
import { filterFieldsFromSchema } from '../../../../../utils/filterFieldsFromSchema';
import { RelationPickerFilters } from './RelationPickerFilters';
import { RelationCandidateList } from './RelationCandidateList';

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

/**
 * The relation picker dialog. Owns the picker's state (staged selection, search,
 * inline filter, lazy-scroll window) and data (the target type's real schema +
 * the mocked candidate query), and composes the pieces:
 * {@link RelationPickerFilters} (search + inline query builder — a disclosure in
 * this one overlay, not a nested modal) and {@link RelationCandidateList}. The
 * selection is staged and only commits on **Add** (many) or on click (single),
 * so closing discards edits.
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
    /**
     * Commit a new id set (single → one id; many → the chosen set) along with
     * the candidates picked this round, so the field can title the new rows.
     */
    onConfirm: (ids: string[], picked: RelationCandidate[]) => void;
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

    // Always-current view of the assigned ids, read by the open-transition reset
    // below without making it a dependency (see next comment).
    const selectedRef = useRef(selectedIds);
    selectedRef.current = selectedIds;
    const wasOpen = useRef(false);

    // Re-seed the staged selection (and reset search/filter/window) only when the
    // dialog *transitions* open, so a close-without-commit discards edits. Keyed
    // on `open` alone — depending on `selectedIds` (a fresh array on every parent
    // render) would re-fire mid-assignment and wipe the user's staged edits.
    useEffect(() => {
        if (open && !wasOpen.current) {
            setDraft(new Set(selectedRef.current));
            setSearch('');
            setFilter(null);
            setFiltersOpen(false);
            setLimit(PAGE_SIZE);
            setLoadingMore(false);
        }
        wasOpen.current = open;
    }, [open]);

    // Clear any in-flight lazy-load timer on unmount.
    useEffect(() => () => clearTimeout(loadTimer.current), []);

    const { data: schema, isPending: schemaPending } = useContentSchema(
        targetName,
        open
    );
    const filterFields = useMemo(
        () => (schema ? filterFieldsFromSchema(schema) : []),
        [schema]
    );

    const {
        items,
        total,
        hasMore,
        isPending: candidatesPending,
        isError: candidatesError
    } = useRelationCandidates(
        targetName,
        schema?.fields ?? [],
        { search, filter, limit },
        open
    );
    // The list is "pending" until both the target schema (for titles) and the
    // first candidate page have arrived.
    const isPending = schemaPending || candidatesPending;

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        // Near the bottom → reveal the next window after a short (simulated)
        // delay so the spinner shows.
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight <= 120 &&
            hasMore &&
            !loadingMore &&
            // Stop growing at the server's cap; beyond it, narrow with search/filter.
            limit < MAX_CANDIDATE_WINDOW
        ) {
            setLoadingMore(true);
            loadTimer.current = setTimeout(() => {
                setLimit((current) =>
                    Math.min(current + PAGE_SIZE, MAX_CANDIDATE_WINDOW)
                );
                setLoadingMore(false);
            }, LAZY_DELAY_MS);
        }
    };

    const narrow = (apply: () => void) => {
        // Any new search/filter starts the window over from the top.
        clearTimeout(loadTimer.current);
        setLoadingMore(false);
        setLimit(PAGE_SIZE);
        apply();
    };

    const filtersActive = !!search.trim() || countRules(filter) > 0;

    const pick = (candidate: RelationCandidate) => {
        if (many) {
            setDraft((current) => {
                const next = new Set(current);
                if (next.has(candidate.id)) next.delete(candidate.id);
                else next.add(candidate.id);
                return next;
            });
        } else {
            onConfirm([candidate.id], [candidate]);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[min(85vh,42rem)] w-full max-w-2xl flex-col gap-4 overflow-hidden">
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

                <RelationPickerFilters
                    targetLabel={targetLabel}
                    search={search}
                    onSearchChange={(next) => narrow(() => setSearch(next))}
                    filterFields={filterFields}
                    filter={filter}
                    onFilterChange={(next) => narrow(() => setFilter(next))}
                    open={filtersOpen}
                    onOpenChange={setFiltersOpen}
                />

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

                <RelationCandidateList
                    items={items}
                    isPending={isPending}
                    isError={candidatesError}
                    loadingMore={loadingMore}
                    filtersActive={filtersActive}
                    many={many}
                    targetName={targetName}
                    targetLabel={targetLabel}
                    checkedIds={draft}
                    selectedId={selectedIds[0]}
                    onPick={pick}
                    onScroll={handleScroll}
                />

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
                                // Pass the picked candidates in the current
                                // window so the field can title new rows; ids
                                // outside it keep their load-time titles.
                                onConfirm(
                                    [...draft],
                                    items.filter((item) => draft.has(item.id))
                                );
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
