import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type ScreenReaderInstructions
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel
} from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { useContentSchema } from '../../../../api/useContentSchema';
import { findMockCandidate } from '../../../../api/useRelationCandidates/mockCandidates';
import { fieldLabel } from '../../../../utils/entryColumns';
import { adminProps } from '../../../../utils/adminProps';
import { relationLabel } from '../../../../utils/relationLabel';
import { toRelationIds } from '../../../../utils/relationIds';
import { RelationItemRow } from './RelationItemRow';
import { SortableRelationItem } from './SortableRelationItem';
import { RelationPickerDialog } from './RelationPickerDialog';

const messages = defineMessages({
    assign: {
        id: 'content.relations.field.assign',
        defaultMessage: 'Select {label}'
    },
    change: {
        id: 'content.relations.field.change',
        defaultMessage: 'Change'
    },
    addMany: {
        id: 'content.relations.field.addMany',
        defaultMessage: 'Add related'
    },
    empty: {
        id: 'content.relations.field.empty',
        defaultMessage: 'Nothing linked yet.'
    },
    remove: {
        id: 'content.relations.field.remove',
        defaultMessage: 'Remove {title}'
    },
    dndInstructions: {
        id: 'content.relations.field.dnd.instructions',
        defaultMessage:
            'To reorder, press Space or Enter to pick up, use the arrow keys to move, then press Space or Enter to drop, or Escape to cancel.'
    },
    dndPickedUp: {
        id: 'content.relations.field.dnd.pickedUp',
        defaultMessage: 'Picked up {title}.'
    },
    dndOver: {
        id: 'content.relations.field.dnd.over',
        defaultMessage: '{title} was moved over {target}.'
    },
    dndDropped: {
        id: 'content.relations.field.dnd.dropped',
        defaultMessage: '{title} was dropped over {target}.'
    },
    dndCancelled: {
        id: 'content.relations.field.dnd.cancelled',
        defaultMessage:
            'Reordering cancelled. {title} returned to its position.'
    }
});

/**
 * A comfortable relation editor for one relation field, replacing the raw id
 * input in the editor's Relations tab. Shows each linked record by its **title**
 * (resolved from the mocked candidates + the target's real schema) with a remove
 * control, and — for a many-relation — drag-and-drop / keyboard **reordering**
 * (the array order is the value). The {@link RelationPickerDialog} handles
 * search, query-builder filtering, and assignment. Fully controlled: a single
 * relation stores one id string, a many-relation a string array.
 */
export function RelationField({
    field,
    value,
    error,
    onChange,
    onBlur,
    hideLabel = false
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
    /** Suppress the built-in label (e.g. when a collapsible header carries it). */
    hideLabel?: boolean;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const relation = field.relation;
    const many = relation?.many ?? false;
    const targetName = relation?.to ?? '';
    const label = fieldLabel(field);
    const description = adminProps(field).description;

    // The target type's schema labels assigned ids and titles each picker row.
    const { data: targetSchema } = useContentSchema(targetName, !!targetName);
    const targetLabel = targetSchema?.label ?? targetName;
    const titleFor = (id: string) =>
        relationLabel(
            findMockCandidate(targetName, id)?.values ?? {},
            targetSchema?.fields ?? [],
            id
        );

    const ids = toRelationIds(value, many);

    const commit = (next: string[]) => {
        onChange(many ? next : (next[0] ?? ''));
        onBlur?.();
    };

    const removeId = (id: string) => commit(ids.filter((each) => each !== id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from !== -1 && to !== -1) commit(arrayMove(ids, from, to));
    };

    // Spoken feedback for keyboard reordering, by record title.
    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            intl.formatMessage(messages.dndPickedUp, {
                title: titleFor(String(active.id))
            }),
        onDragOver: ({ active, over }) =>
            over
                ? intl.formatMessage(messages.dndOver, {
                      title: titleFor(String(active.id)),
                      target: titleFor(String(over.id))
                  })
                : undefined,
        onDragEnd: ({ active, over }) =>
            over
                ? intl.formatMessage(messages.dndDropped, {
                      title: titleFor(String(active.id)),
                      target: titleFor(String(over.id))
                  })
                : undefined,
        onDragCancel: ({ active }) =>
            intl.formatMessage(messages.dndCancelled, {
                title: titleFor(String(active.id))
            })
    };
    const screenReaderInstructions: ScreenReaderInstructions = {
        draggable: intl.formatMessage(messages.dndInstructions)
    };

    const triggerLabel = many
        ? messages.addMany
        : ids.length > 0
          ? messages.change
          : messages.assign;

    const removeLabelFor = (title: string) =>
        intl.formatMessage(messages.remove, { title });

    return (
        <Field data-invalid={!!error}>
            {hideLabel ? null : <FieldLabel>{label}</FieldLabel>}

            {ids.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div
                    className={`flex flex-col gap-2 ${
                        ids.length > 6 ? 'max-h-72 overflow-y-auto pr-1' : ''
                    }`}
                >
                    {many ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                            accessibility={{
                                announcements,
                                screenReaderInstructions
                            }}
                        >
                            <SortableContext
                                items={ids}
                                strategy={verticalListSortingStrategy}
                            >
                                {ids.map((id) => {
                                    const title = titleFor(id);
                                    return (
                                        <SortableRelationItem
                                            key={id}
                                            id={id}
                                            title={title}
                                            onRemove={() => removeId(id)}
                                            removeLabel={removeLabelFor(title)}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        ids.map((id) => {
                            const title = titleFor(id);
                            return (
                                <RelationItemRow
                                    key={id}
                                    title={title}
                                    onRemove={() => removeId(id)}
                                    removeLabel={removeLabelFor(title)}
                                />
                            );
                        })
                    )}
                </div>
            )}

            <div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    onClick={() => setOpen(true)}
                >
                    <Plus className="size-4" />
                    {intl.formatMessage(triggerLabel, { label: targetLabel })}
                </Button>
            </div>

            {description && !error ? (
                <FieldDescription>{description}</FieldDescription>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}

            <RelationPickerDialog
                open={open}
                onOpenChange={setOpen}
                targetName={targetName}
                targetLabel={targetLabel}
                many={many}
                selectedIds={ids}
                onConfirm={commit}
            />
        </Field>
    );
}
