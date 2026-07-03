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
import type { ContentField } from '../../../../types/contentType';
import { useContentSchema } from '../../../../api/useContentSchema';
import { useRelationFieldLinks } from '../../../../api/useRelationFieldLinks';
import { useRelationDelta } from '../../../../api/useRelationDelta';
import { RelationItemRow } from '../RelationField/RelationItemRow';
import { SortableRelationItem } from '../RelationField/SortableRelationItem';
import { RelationPickerDialog } from '../RelationField/RelationPickerDialog';

const messages = defineMessages({
    assign: {
        id: 'content.relations.live.assign',
        defaultMessage: 'Select {label}'
    },
    add: { id: 'content.relations.live.add', defaultMessage: 'Add related' },
    change: { id: 'content.relations.live.change', defaultMessage: 'Change' },
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
    },
    more: {
        id: 'content.relations.live.more',
        defaultMessage: '{count} more'
    }
});

/**
 * The **edit-mode** relation editor for one many/inverse relation field: unlike
 * the create-mode {@link RelationField} (which stages a small array in the form
 * and saves it with the entry), this manages the links **live** against an
 * existing entry — the assigned list is **infinite-scroll paginated**
 * (`useRelationFieldLinks`), and assign / unassign / reorder each apply an
 * **incremental delta** immediately (`useRelationDelta`), so a relation holding
 * thousands of links is never loaded or sent whole. Owning many-relations are
 * drag/keyboard reorderable (persisted via `position`); the inverse side reads
 * order but can't reorder it, so its rows aren't sortable.
 */
export function RelationFieldLive({
    field,
    typeName,
    entryId
}: {
    field: ContentField;
    typeName: string;
    /** The existing entry's id — required (this is the edit-mode path). */
    entryId: string;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const targetName = field.relation?.to ?? '';
    // Owning many-relations own their order; an inverse reads it but can't set it.
    const reorderable = !!field.relation?.many && !field.relation?.inverse;

    const { data: targetSchema } = useContentSchema(targetName, !!targetName);
    const targetLabel = targetSchema?.label ?? targetName;

    const links = useRelationFieldLinks(typeName, entryId, field.name);
    const delta = useRelationDelta(typeName, entryId);

    const items = links.items;
    const ids = items.map((item) => item.id);
    const removeLabelFor = (title: string) =>
        intl.formatMessage(messages.remove, { title });

    // Assign the picked records that aren't already linked (server dedupes too).
    const confirm = (picked: string[]) => {
        const linked = new Set(ids);
        const link = picked.filter((id) => !linked.has(id));
        if (link.length) delta.mutate({ field: field.name, delta: { link } });
    };

    const removeId = (id: string) =>
        delta.mutate({ field: field.name, delta: { unlink: [id] } });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from === -1 || to === -1) return;
        // Persist the loaded window's new order (positions renumber server-side).
        delta.mutate({
            field: field.name,
            delta: { order: arrayMove(ids, from, to) }
        });
    };

    // Near the bottom → pull the next page (infinite scroll).
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

    const remaining = links.total - items.length;
    const triggerLabel = field.relation?.many
        ? messages.add
        : ids.length > 0
          ? messages.change
          : messages.assign;

    return (
        <div className="flex flex-col gap-3">
            {links.isError ? (
                <p className="text-sm text-destructive">
                    {intl.formatMessage(messages.loadError)}
                </p>
            ) : links.isPending ? (
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
                                {items.map((item) => (
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
                        items.map((item) => (
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
                    ) : remaining > 0 ? (
                        <p className="py-1 text-center text-xs text-muted-foreground">
                            {intl.formatMessage(messages.more, {
                                count: remaining
                            })}
                        </p>
                    ) : null}
                </div>
            )}

            <div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    onClick={() => setOpen(true)}
                    disabled={delta.isPending}
                >
                    <Plus className="size-4" />
                    {intl.formatMessage(triggerLabel, { label: targetLabel })}
                </Button>
            </div>

            <RelationPickerDialog
                open={open}
                onOpenChange={setOpen}
                targetName={targetName}
                targetLabel={targetLabel}
                many={field.relation?.many ?? false}
                selectedIds={ids}
                onConfirm={(picked) => confirm(picked)}
            />
        </div>
    );
}
