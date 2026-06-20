import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
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
    horizontalListSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
    Badge,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../types/contentType';
import { fieldLabel, type EntryColumn } from '../../../utils/entryColumns';
import { renderCell } from './renderCell';

/** Intl descriptors for {@link CollectionRecordsTable}, co-located. */
const messages = defineMessages({
    status: { id: 'content.records.column.status', defaultMessage: 'Status' },
    updated: { id: 'content.records.column.updated', defaultMessage: 'Updated' },
    caption: {
        id: 'content.records.table.caption',
        defaultMessage: '{label} records'
    },
    selectAll: {
        id: 'content.records.selectAll',
        defaultMessage: 'Select all rows on this page'
    },
    selectRow: {
        id: 'content.records.selectRow',
        defaultMessage: 'Select row'
    },
    reorder: {
        id: 'content.records.reorderColumn',
        defaultMessage: 'Reorder {column} column'
    }
});

/** The localized header label for one column. */
function useColumnLabel() {
    const intl = useIntl();
    return (column: EntryColumn): string => {
        switch (column.kind) {
            case 'status':
                return intl.formatMessage(messages.status);
            case 'updated':
                return intl.formatMessage(messages.updated);
            case 'field':
                return fieldLabel(column.field);
        }
    };
}

/**
 * A draggable, keyboard-reorderable header cell. The whole cell is the sortable
 * node; a `GripVertical` handle carries the drag listeners (with an `aria-label`
 * and dnd-kit's keyboard attributes) so the column can be picked up and moved
 * with the keyboard, not just the pointer.
 */
function SortableHeadCell({
    column,
    label
}: {
    column: EntryColumn;
    label: string;
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
        <TableHead
            ref={setNodeRef}
            scope="col"
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            className={isDragging ? 'z-10 bg-muted' : undefined}
        >
            <span className="inline-flex items-center gap-1">
                <button
                    type="button"
                    className="-ml-1 cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(messages.reorder, {
                        column: label
                    })}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" aria-hidden />
                </button>
                {label}
            </span>
        </TableHead>
    );
}

/** The cell content for one column of one record. */
function Cell({
    column,
    record
}: {
    column: EntryColumn;
    record: EntryRecord;
}) {
    const intl = useIntl();
    switch (column.kind) {
        case 'status':
            return (
                <Badge
                    variant={
                        record.status === 'published' ? 'default' : 'secondary'
                    }
                >
                    {record.status}
                </Badge>
            );
        case 'updated':
            return (
                <span className="text-sm text-muted-foreground">
                    {intl.formatDate(record.updatedAt, { dateStyle: 'medium' })}
                </span>
            );
        case 'field':
            return (
                <>{renderCell(column.field, record.values[column.id], intl)}</>
            );
    }
}

/**
 * The collection's records table, built from the visible {@link EntryColumn}s.
 * A leading, fixed checkbox column drives row selection (header = select-all for
 * the current page, with an indeterminate state); the data-column headers are
 * drag-and-drop / keyboard reorderable (dnd-kit). The whole row links to the
 * entry's detail stub, the first data cell holds a real `<a>` for keyboard users,
 * and the checkbox cell stops propagation so selecting doesn't navigate. Header
 * cells carry `scope="col"` and the table an `aria-label`.
 */
export function CollectionRecordsTable({
    label,
    entries,
    columns,
    typePath,
    selectedIds,
    onToggleRow,
    onTogglePage,
    onReorder
}: {
    /** The content type's display label, for the table caption. */
    label: string;
    /** The page of records to render. */
    entries: EntryRecord[];
    /** The visible columns, in display order. */
    columns: EntryColumn[];
    /** Absolute path to this type, e.g. `/workspaces/:id/content/:typeName`. */
    typePath: string;
    /** Currently selected record ids. */
    selectedIds: Set<string>;
    /** Toggle one row's selection. */
    onToggleRow: (id: string) => void;
    /** Select or clear every row on the current page. */
    onTogglePage: (ids: string[], select: boolean) => void;
    /** Move the `active` column to the `over` column's position. */
    onReorder: (activeId: string, overId: string) => void;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const columnLabel = useColumnLabel();
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const pageIds = entries.map((record) => record.id);
    const allSelected =
        entries.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const someSelected = pageIds.some((id) => selectedIds.has(id));
    const headerChecked = allSelected
        ? true
        : someSelected
          ? 'indeterminate'
          : false;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            onReorder(String(active.id), String(over.id));
        }
    };

    return (
        <div className="rounded-xl border">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <Table
                    aria-label={intl.formatMessage(messages.caption, { label })}
                >
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={headerChecked}
                                    onCheckedChange={(checked) =>
                                        onTogglePage(pageIds, checked === true)
                                    }
                                    aria-label={intl.formatMessage(
                                        messages.selectAll
                                    )}
                                />
                            </TableHead>
                            <SortableContext
                                items={columns.map((column) => column.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                {columns.map((column) => (
                                    <SortableHeadCell
                                        key={column.id}
                                        column={column}
                                        label={columnLabel(column)}
                                    />
                                ))}
                            </SortableContext>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((record) => {
                            const selected = selectedIds.has(record.id);
                            return (
                                <TableRow
                                    key={record.id}
                                    data-state={
                                        selected ? 'selected' : undefined
                                    }
                                    onClick={() =>
                                        navigate(`${typePath}/${record.id}`)
                                    }
                                    className="cursor-pointer"
                                >
                                    <TableCell
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        <Checkbox
                                            checked={selected}
                                            onCheckedChange={() =>
                                                onToggleRow(record.id)
                                            }
                                            aria-label={intl.formatMessage(
                                                messages.selectRow
                                            )}
                                        />
                                    </TableCell>
                                    {columns.map((column, index) => (
                                        <TableCell key={column.id}>
                                            {index === 0 ? (
                                                <Link
                                                    to={`${typePath}/${record.id}`}
                                                    className="block hover:underline"
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <Cell
                                                        column={column}
                                                        record={record}
                                                    />
                                                </Link>
                                            ) : (
                                                <Cell
                                                    column={column}
                                                    record={record}
                                                />
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </DndContext>
        </div>
    );
}
