import { defineMessages, useIntl } from 'react-intl';
import { Columns3 } from 'lucide-react';
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
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@ortha-cms/design-system';
import type { EntryColumn } from '../../../../domain/entryColumns';
import { useColumnLabel } from '../../../hooks/useColumnLabel';
import { ColumnRow } from './ColumnRow';
import { SortableColumnRow } from './SortableColumnRow';

/** Intl descriptors for {@link CollectionRecordsColumnPicker}, co-located. */
const messages = defineMessages({
    trigger: {
        id: 'content.records.columns.trigger',
        defaultMessage: 'Columns'
    },
    heading: {
        id: 'content.records.columns.heading',
        defaultMessage: 'Toggle and reorder columns'
    },
    dndInstructions: {
        id: 'content.records.columns.dnd.instructions',
        defaultMessage:
            'To reorder a column, press Space or Enter to pick it up, use the arrow keys to move it, then press Space or Enter again to drop it, or Escape to cancel.'
    },
    dndPickedUp: {
        id: 'content.records.columns.dnd.pickedUp',
        defaultMessage: 'Picked up the {column} column.'
    },
    dndOver: {
        id: 'content.records.columns.dnd.over',
        defaultMessage: 'The {column} column was moved over {target}.'
    },
    dndDropped: {
        id: 'content.records.columns.dnd.dropped',
        defaultMessage: 'The {column} column was dropped over {target}.'
    },
    dndCancelled: {
        id: 'content.records.columns.dnd.cancelled',
        defaultMessage:
            'Reordering cancelled. The {column} column returned to its position.'
    }
});

/**
 * The column-visibility + ordering control: a popover listing every available
 * column. Visible columns come first as **drag-and-drop / keyboard reorderable**
 * rows (the order is the table's display order); hidden columns follow as plain
 * toggles. Visibility and order are owned by `useEntryColumns` (component state
 * for the session, not persisted), so this is a thin controlled view over
 * `visible`/`toggle`/`reorder`. A
 * column can't be hidden if it's the last one standing, so the table never blanks.
 */
export function CollectionRecordsColumnPicker({
    columns,
    visible,
    isVisible,
    onToggle,
    onReorder,
    visibleCount
}: {
    /** Every available column. */
    columns: EntryColumn[];
    /** Visible column ids, in display order. */
    visible: string[];
    /** Whether a column id is currently shown. */
    isVisible: (id: string) => boolean;
    /** Toggle a column's visibility. */
    onToggle: (id: string) => void;
    /** Move the `active` column to the `over` column's position. */
    onReorder: (activeId: string, overId: string) => void;
    /** How many columns are currently visible (to guard the last one). */
    visibleCount: number;
}) {
    const intl = useIntl();
    const labelOf = useColumnLabel();
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const byId = new Map(columns.map((column) => [column.id, column]));
    // Visible columns in persisted display order; hidden ones keep schema order.
    const visibleColumns = visible
        .map((id) => byId.get(id))
        .filter((column): column is EntryColumn => column !== undefined);
    const hiddenColumns = columns.filter((column) => !isVisible(column.id));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            onReorder(String(active.id), String(over.id));
        }
    };

    // Spoken feedback for keyboard reordering. dnd-kit ships English defaults
    // keyed by raw id; these announce the column *labels* and localize.
    const labelFor = (id: string | number): string => {
        const column = byId.get(String(id));
        return column ? labelOf(column) : String(id);
    };
    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            intl.formatMessage(messages.dndPickedUp, {
                column: labelFor(active.id)
            }),
        onDragOver: ({ active, over }) =>
            over
                ? intl.formatMessage(messages.dndOver, {
                      column: labelFor(active.id),
                      target: labelFor(over.id)
                  })
                : undefined,
        onDragEnd: ({ active, over }) =>
            over
                ? intl.formatMessage(messages.dndDropped, {
                      column: labelFor(active.id),
                      target: labelFor(over.id)
                  })
                : undefined,
        onDragCancel: ({ active }) =>
            intl.formatMessage(messages.dndCancelled, {
                column: labelFor(active.id)
            })
    };
    const screenReaderInstructions: ScreenReaderInstructions = {
        draggable: intl.formatMessage(messages.dndInstructions)
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="shadow-none">
                    <Columns3 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.trigger)}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="max-h-80 w-64 overflow-y-auto p-2"
            >
                <p className="px-1 py-1.5 text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.heading)}
                </p>
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
                        items={visible}
                        strategy={verticalListSortingStrategy}
                    >
                        {visibleColumns.map((column) => (
                            <SortableColumnRow
                                key={column.id}
                                column={column}
                                label={labelOf(column)}
                                // Keep at least one column so the table never blanks.
                                disabled={visibleCount <= 1}
                                onToggle={() => onToggle(column.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
                {hiddenColumns.length > 0 && (
                    <>
                        <div className="my-1 h-px bg-border" role="separator" />
                        {hiddenColumns.map((column) => (
                            <ColumnRow
                                key={column.id}
                                column={column}
                                label={labelOf(column)}
                                checked={false}
                                onToggle={() => onToggle(column.id)}
                                // Spacer aligns the checkbox with the dragged rows.
                                handle={<span className="w-5 shrink-0" />}
                            />
                        ))}
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
