import type { CSSProperties, ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Columns3, GripVertical } from 'lucide-react';
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
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Button,
    Checkbox,
    Popover,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@ortha-cms/design-system';
import { fieldLabel, type EntryColumn } from '../../../utils/entryColumns';

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
    status: { id: 'content.records.column.status', defaultMessage: 'Status' },
    updated: { id: 'content.records.column.updated', defaultMessage: 'Updated' },
    reorder: {
        id: 'content.records.columns.reorder',
        defaultMessage: 'Reorder {column} column'
    }
});

/**
 * One row in the picker: a checkbox toggling visibility plus its label. The
 * `handle` slot holds either a drag handle (visible, reorderable columns) or a
 * spacer (hidden columns) so both align. The label is tied to the checkbox so a
 * click anywhere on it toggles, and the row reads as one control to assistive
 * tech.
 */
function ColumnRow({
    column,
    label,
    checked,
    disabled,
    onToggle,
    handle,
    dragging,
    rowRef,
    style
}: {
    column: EntryColumn;
    label: string;
    checked: boolean;
    disabled?: boolean;
    onToggle: () => void;
    handle: ReactNode;
    dragging?: boolean;
    rowRef?: (node: HTMLElement | null) => void;
    style?: CSSProperties;
}) {
    const checkboxId = `column-toggle-${column.id}`;
    return (
        <div
            ref={rowRef}
            style={style}
            className={cn(
                'flex items-center gap-2 rounded-md px-1 py-1.5 text-sm',
                dragging && 'bg-muted'
            )}
        >
            {handle}
            <Checkbox
                id={checkboxId}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onToggle}
            />
            <label
                htmlFor={checkboxId}
                className="flex-1 cursor-pointer select-none"
            >
                {label}
            </label>
        </div>
    );
}

/** A visible column's row, made sortable (drag + keyboard) via dnd-kit. */
function SortableColumnRow({
    column,
    label,
    disabled,
    onToggle
}: {
    column: EntryColumn;
    label: string;
    disabled: boolean;
    onToggle: () => void;
}) {
    const intl = useIntl();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: column.id });

    return (
        <ColumnRow
            column={column}
            label={label}
            checked
            disabled={disabled}
            onToggle={onToggle}
            dragging={isDragging}
            rowRef={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            handle={
                <button
                    type="button"
                    className="cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(messages.reorder, {
                        column: label
                    })}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden />
                </button>
            }
        />
    );
}

/**
 * The column-visibility + ordering control: a popover listing every available
 * column. Visible columns come first as **drag-and-drop / keyboard reorderable**
 * rows (the order is the table's display order); hidden columns follow as plain
 * toggles. Visibility and order are owned by `useEntryColumns` (persisted per
 * type), so this is a thin controlled view over `visible`/`toggle`/`reorder`. A
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
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const labelOf = (column: EntryColumn): string => {
        switch (column.kind) {
            case 'status':
                return intl.formatMessage(messages.status);
            case 'updated':
                return intl.formatMessage(messages.updated);
            case 'field':
                return fieldLabel(column.field);
        }
    };

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
