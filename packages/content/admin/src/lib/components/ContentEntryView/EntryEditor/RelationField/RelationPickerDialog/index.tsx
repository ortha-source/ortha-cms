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
    type RelationCandidate
} from '../../../../../api/useRelationCandidates';
import { useEntrySlotContext } from '../../../../../hooks/useEntrySlotContext';
import { ENTRY_PARAMS_SLOT } from '../../../../../slots/contentSlots';
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
    const [draft, setDraft] = useState<Set<string>>(new Set());
    // Titles for every candidate checked this round, retained even after it
    // scrolls or filters out of the current `items` window — otherwise a record
    // checked under one search then hidden by the next would confirm with no
    // title and fall back to its raw id until the save round-trips (#5). Keyed by
    // id; reset with `draft` when the dialog re-opens.
    const [picked, setPicked] = useState<Map<string, RelationCandidate>>(
        new Map()
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
            setPicked(new Map());
            setSearch('');
            setFilter(null);
            setFiltersOpen(false);
        }
        wasOpen.current = open;
    }, [open]);

    const { data: schema, isPending: schemaPending } = useContentSchema(
        targetName,
        open
    );
    const filterFields = useMemo(
        () => (schema ? filterFieldsFromSchema(schema) : []),
        [schema]
    );

    // Slot-contributed candidate params (e.g. locale scoping from the i18n
    // plugin), computed against the target's schema and the surrounding
    // editor's slot context. Boot-frozen items → stable across renders.
    const slotContext = useEntrySlotContext();
    const extraParams = useMemo(() => {
        if (!schema || !slotContext) return {};
        const merged: Record<string, string> = {};
        for (const item of ENTRY_PARAMS_SLOT.getItems()) {
            Object.assign(
                merged,
                item.relationCandidateParams?.(schema, slotContext) ?? {}
            );
        }
        return merged;
    }, [schema, slotContext]);

    const {
        items,
        total,
        hasMore,
        isPending: candidatesPending,
        isError: candidatesError,
        isFetchingNextPage,
        fetchNextPage
    } = useRelationCandidates(
        targetName,
        schema?.fields ?? [],
        {
            search,
            filter,
            ...(Object.keys(extraParams).length ? { extra: extraParams } : {})
        },
        open
    );
    // The list is "pending" until both the target schema (for titles) and the
    // first candidate page have arrived.
    const isPending = schemaPending || candidatesPending;

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        // Near the bottom → pull the next real page (no artificial window cap;
        // the list grows until every match is loaded).
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight <= 120 &&
            hasMore &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
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
            // Remember the candidate so its title survives leaving the window.
            setPicked((current) => {
                const next = new Map(current);
                next.set(candidate.id, candidate);
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
                    onSearchChange={setSearch}
                    filterFields={filterFields}
                    filter={filter}
                    onFilterChange={setFilter}
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
                    loadingMore={isFetchingNextPage}
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
                                // Title new rows from the retained `picked` map,
                                // not the current `items` window — so a record
                                // checked under an earlier search still carries
                                // its title even after it scrolled/filtered out.
                                // Ids already linked (never toggled) keep their
                                // load-time titles.
                                onConfirm(
                                    [...draft],
                                    [...draft]
                                        .map((id) => picked.get(id))
                                        .filter(
                                            (c): c is RelationCandidate => !!c
                                        )
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
