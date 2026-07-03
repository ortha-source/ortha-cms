import { useState, type UIEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Button, Spinner } from '@ortha-cms/design-system';
import type {
    ContentField,
    RelationRef,
    StagedRelation
} from '../../../../types/contentType';
import { useContentSchema } from '../../../../api/useContentSchema';
import { useRelationFieldLinks } from '../../../../api/useRelationFieldLinks';
import type { RelationCandidate } from '../../../../api/useRelationCandidates';
import { RelationItemRow } from '../RelationField/RelationItemRow';
import { SortableRelationItem } from '../RelationField/SortableRelationItem';
import { RelationPickerDialog } from '../RelationField/RelationPickerDialog';

const messages = defineMessages({
    assign: {
        id: 'content.relations.live.assign',
        defaultMessage: 'Select {label}'
    },
    add: { id: 'content.relations.live.add', defaultMessage: 'Add related' },
    empty: {
        id: 'content.relations.live.empty',
        defaultMessage: 'Nothing linked yet.'
    },
    remove: {
        id: 'content.relations.live.remove',
        defaultMessage: 'Remove {title}'
    },
    loadError: {
        id: 'content.relations.live.loadError',
        defaultMessage: 'Couldn’t load linked records.'
    }
});

/** Apply a {@link StagedRelation} to the server-loaded links → the displayed set. */
function applyStaged(
    serverItems: RelationRef[],
    staged: StagedRelation
): RelationRef[] {
    const removed = new Set(staged.removed);
    const base = serverItems.filter((item) => !removed.has(item.id));
    const merged = [
        ...base,
        ...staged.added.filter((a) => !base.some((b) => b.id === a.id))
    ];
    if (!staged.order) return merged;
    // Reordered ids first (in the stored sequence); anything not in `order`
    // (e.g. a page loaded after the reorder) keeps its natural order at the end.
    const rank = new Map(staged.order.map((id, i) => [id, i]));
    return [...merged].sort(
        (a, b) =>
            (rank.get(a.id) ?? Number.POSITIVE_INFINITY) -
            (rank.get(b.id) ?? Number.POSITIVE_INFINITY)
    );
}

/**
 * The relation editor for one **many/inverse** relation field. It shows the
 * assigned records — the server set (infinite-scroll paginated via
 * {@link useRelationFieldLinks} on an existing entry; empty while creating) with
 * the user's **local staging** overlaid — and every assign / unassign / reorder
 * updates that staging **only** (`onStagedChange`): nothing is sent until the
 * user hits Save, which submits the whole document plus the relation deltas in
 * one request. Fully controlled: `staged` is owned by the editor so edits
 * survive collapsing the section or switching tabs. Owning many-relations
 * reorder (persisted via `position`); the inverse reads order but isn't sortable.
 */
export function RelationFieldLive({
    field,
    typeName,
    entryId,
    staged,
    onStagedChange
}: {
    field: ContentField;
    typeName: string;
    /** The existing entry's id, or undefined while creating (no server set). */
    entryId?: string;
    /** The field's pending link/unlink/reorder (editor-owned). */
    staged: StagedRelation;
    onStagedChange: (next: StagedRelation) => void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const many = field.relation?.many ?? false;
    const targetName = field.relation?.to ?? '';
    // Owning many-relations own their order; an inverse reads it but can't set it.
    const reorderable = many && !field.relation?.inverse;

    const { data: targetSchema } = useContentSchema(targetName, !!targetName);
    const targetLabel = targetSchema?.label ?? targetName;

    const links = useRelationFieldLinks(typeName, entryId, field.name, !!entryId);
    const serverItems = entryId ? links.items : [];

    const displayed = applyStaged(serverItems, staged);
    const ids = displayed.map((item) => item.id);
    const removeLabelFor = (title: string) =>
        intl.formatMessage(messages.remove, { title });

    // Reconcile the picker's chosen set against what's displayed: link the new
    // ones (remembering their title), unlink the ones it dropped — all into the
    // staged diff, no request.
    const confirm = (chosenIds: string[], picked: RelationCandidate[]) => {
        const chosen = new Set(chosenIds);
        const toRemove = ids.filter((id) => !chosen.has(id));
        const toAdd = chosenIds.filter((id) => !ids.includes(id));
        const byId = new Map(picked.map((c) => [c.id, c]));

        let added = [...staged.added];
        let removed = [...staged.removed];
        for (const id of toRemove) {
            if (added.some((a) => a.id === id))
                added = added.filter((a) => a.id !== id);
            else if (!removed.includes(id)) removed = [...removed, id];
        }
        for (const id of toAdd) {
            if (removed.includes(id)) {
                removed = removed.filter((x) => x !== id); // re-link a server item
            } else if (
                !serverItems.some((s) => s.id === id) &&
                !added.some((a) => a.id === id)
            ) {
                const c = byId.get(id);
                added = [
                    ...added,
                    {
                        id,
                        title: c?.title ?? id,
                        ...(c?.status ? { status: c.status } : {})
                    }
                ];
            }
        }
        const order = staged.order
            ? staged.order.filter((x) => !toRemove.includes(x))
            : null;
        onStagedChange({ added, removed, order });
    };

    const removeId = (id: string) => confirm(ids.filter((x) => x !== id), []);

    // Open the picker against the **full** linked set, not just the pages loaded
    // so far: pull any unfetched link pages first, so an already-linked record on
    // an unloaded page is shown pre-checked (and reconciled as such) rather than
    // offered as a brand-new add — which would double-count in the header. Only
    // this explicit action loads the rest; entry load stays first-page-only.
    const openPicker = async () => {
        if (links.hasNextPage && !preparing) {
            setPreparing(true);
            try {
                let more: boolean = links.hasNextPage;
                while (more) {
                    const result = await links.fetchNextPage();
                    more = result.hasNextPage;
                }
            } finally {
                setPreparing(false);
            }
        }
        setOpen(true);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from === -1 || to === -1) return;
        onStagedChange({ ...staged, order: arrayMove(ids, from, to) });
    };

    // Near the bottom → pull the next server page (edit mode only).
    const onScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight <= 120 &&
            links.hasNextPage &&
            !links.isFetchingNextPage
        ) {
            links.fetchNextPage();
        }
    };

    const triggerLabel = many ? messages.add : messages.assign;

    return (
        <div className="flex flex-col gap-3">
            {links.isError ? (
                <p className="text-sm text-destructive">
                    {intl.formatMessage(messages.loadError)}
                </p>
            ) : links.isLoading ? (
                <div className="flex justify-center py-4">
                    <Spinner aria-hidden />
                </div>
            ) : ids.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div
                    className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1"
                    onScroll={onScroll}
                >
                    {reorderable ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={ids}
                                strategy={verticalListSortingStrategy}
                            >
                                {displayed.map((item) => (
                                    <SortableRelationItem
                                        key={item.id}
                                        id={item.id}
                                        title={item.title}
                                        onRemove={() => removeId(item.id)}
                                        removeLabel={removeLabelFor(item.title)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        displayed.map((item) => (
                            <RelationItemRow
                                key={item.id}
                                title={item.title}
                                onRemove={() => removeId(item.id)}
                                removeLabel={removeLabelFor(item.title)}
                            />
                        ))
                    )}

                    {links.isFetchingNextPage ? (
                        <div className="flex justify-center py-2">
                            <Spinner aria-hidden />
                        </div>
                    ) : null}
                </div>
            )}

            <div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    onClick={openPicker}
                    disabled={preparing}
                >
                    {preparing ? (
                        <Spinner className="size-4" aria-hidden />
                    ) : (
                        <Plus className="size-4" />
                    )}
                    {intl.formatMessage(triggerLabel, { label: targetLabel })}
                </Button>
            </div>

            <RelationPickerDialog
                open={open}
                onOpenChange={setOpen}
                targetName={targetName}
                targetLabel={targetLabel}
                many={many}
                selectedIds={ids}
                onConfirm={confirm}
            />
        </div>
    );
}
