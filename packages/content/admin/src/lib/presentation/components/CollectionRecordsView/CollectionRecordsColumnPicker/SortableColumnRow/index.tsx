import { defineMessages, useIntl } from 'react-intl';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EntryColumn } from '../../../../../domain/entryColumns';
import { ColumnRow } from '../ColumnRow';

/** Co-located label for the drag handle. */
const messages = defineMessages({
    reorder: {
        id: 'content.records.columns.reorder',
        defaultMessage: 'Reorder {column} column'
    }
});

/** A visible column's {@link ColumnRow}, made sortable (drag + keyboard) via dnd-kit. */
export function SortableColumnRow({
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
