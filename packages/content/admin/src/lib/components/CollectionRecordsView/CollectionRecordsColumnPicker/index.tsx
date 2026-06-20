import { defineMessages, useIntl } from 'react-intl';
import { Columns3 } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { fieldLabel, type EntryColumn } from '../../../utils/entryColumns';

/** Intl descriptors for {@link CollectionRecordsColumnPicker}, co-located. */
const messages = defineMessages({
    trigger: { id: 'content.records.columns.trigger', defaultMessage: 'Columns' },
    heading: {
        id: 'content.records.columns.heading',
        defaultMessage: 'Toggle columns'
    },
    status: { id: 'content.records.column.status', defaultMessage: 'Status' },
    updated: { id: 'content.records.column.updated', defaultMessage: 'Updated' }
});

/**
 * The column-visibility menu: a checkbox per available column, toggling whether
 * it shows in the table. The choice is owned by `useEntryColumns` (persisted per
 * type), so this is a thin controlled view over `isVisible`/`toggle`. A column
 * can't be hidden if it's the last one standing, so the table never goes blank.
 */
export function CollectionRecordsColumnPicker({
    columns,
    isVisible,
    onToggle,
    visibleCount
}: {
    /** Every available column. */
    columns: EntryColumn[];
    /** Whether a column id is currently shown. */
    isVisible: (id: string) => boolean;
    /** Toggle a column's visibility. */
    onToggle: (id: string) => void;
    /** How many columns are currently visible (to guard the last one). */
    visibleCount: number;
}) {
    const intl = useIntl();

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

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shadow-none">
                    <Columns3 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.trigger)}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>
                    {intl.formatMessage(messages.heading)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((column) => {
                    const shown = isVisible(column.id);
                    return (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={shown}
                            // Keep at least one column so the table never blanks.
                            disabled={shown && visibleCount <= 1}
                            onCheckedChange={() => onToggle(column.id)}
                            onSelect={(event) => event.preventDefault()}
                        >
                            {labelOf(column)}
                        </DropdownMenuCheckboxItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
