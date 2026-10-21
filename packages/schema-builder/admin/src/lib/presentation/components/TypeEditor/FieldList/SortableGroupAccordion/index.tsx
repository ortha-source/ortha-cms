import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import {
    cn,
    dragLiftClassName,
    usePrefersReducedMotion
} from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../fieldListEditing';
import { GroupAccordion } from '../GroupAccordion';
import {
    groupSortId,
    type SortableGroupData,
    type SortableList
} from '../sortableList';

const messages = defineMessages({
    reorder: {
        id: 'schemaBuilder.group.reorder',
        defaultMessage: 'Reorder the group {label}'
    }
});

/**
 * A group block that can be dragged — by pointer or, from its handle, by
 * keyboard — among the other groups on General: the order the entry editor
 * draws them in.
 */
export function SortableGroupAccordion({
    group,
    list,
    editing
}: {
    group: GroupDoc;
    list: SortableList;
    editing: FieldListEditing;
}) {
    const intl = useIntl();
    const data: SortableGroupData = { group: group.key };
    const reducedMotion = usePrefersReducedMotion();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: groupSortId(group.key),
        data,
        // dnd-kit's glide is an inline style, out of reach of any
        // `motion-reduce:` class — so it is switched off at the source.
        transition: reducedMotion ? null : undefined
    });
    return (
        <div
            ref={setNodeRef}
            style={{
                // Translate only: a group stretched to another's height
                // would squash its rows.
                transform: CSS.Translate.toString(transform),
                transition
            }}
            className={isDragging ? 'relative z-10' : undefined}
        >
            <GroupAccordion
                group={group}
                list={list}
                editing={editing}
                // The lift goes on the card, not the wrapper: the card's
                // margins sit inside the wrapper, and a shadow drawn there
                // would be a rectangle around the gap. The wrapper keeps the
                // translate (and with it dnd-kit's inline transition), so the
                // card's own class transition is never overridden.
                className={dragLiftClassName(isDragging)}
                handle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className={cn(
                            'rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                        )}
                        aria-label={intl.formatMessage(messages.reorder, {
                            label: group.label
                        })}
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="size-4" aria-hidden />
                    </button>
                }
            />
        </div>
    );
}
