import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
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
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: groupSortId(group.key), data });
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
                className={isDragging ? 'shadow-md' : undefined}
                handle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        className="cursor-grab rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
