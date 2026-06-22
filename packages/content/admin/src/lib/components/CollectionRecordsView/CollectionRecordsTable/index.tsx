import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
import { CollectionRecordsRowActions } from './CollectionRecordsRowActions';

/** The current table sort: a column id and direction, or none. */
export type TableSort = { key: string; dir: 'asc' | 'desc' } | null;

/** Intl descriptors for {@link CollectionRecordsTable}, co-located. */
const messages = defineMessages({
    status: { id: 'content.records.column.status', defaultMessage: 'Status' },
    updated: { id: 'content.records.column.updated', defaultMessage: 'Updated' },
    actions: { id: 'content.records.column.actions', defaultMessage: 'Actions' },
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
    sortBy: {
        id: 'content.records.sortBy',
        defaultMessage: 'Sort by {column}'
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
 * the current page, with an indeterminate state). The whole row links to the
 * entry's detail stub, the first data cell holds a real `<a>` for keyboard users,
 * and the checkbox cell stops propagation so selecting doesn't navigate. Header
 * cells carry `scope="col"` and the table an `aria-label`. Column **order** is
 * chosen in the column picker (drag-to-reorder lives there), so the headers here
 * are static.
 */
export function CollectionRecordsTable({
    label,
    entries,
    columns,
    typePath,
    publishable,
    selectedIds,
    onToggleRow,
    onTogglePage,
    sort,
    onSort
}: {
    /** The content type's display label, for the table caption. */
    label: string;
    /** The page of records to render. */
    entries: EntryRecord[];
    /** The visible columns, in display order. */
    columns: EntryColumn[];
    /** Absolute path to this type, e.g. `/workspaces/:id/content/:typeName`. */
    typePath: string;
    /** Whether the type has a publish workflow (drives the row Publish/Unpublish action). */
    publishable: boolean;
    /** Currently selected record ids. */
    selectedIds: Set<string>;
    /** Toggle one row's selection. */
    onToggleRow: (id: string) => void;
    /** Select or clear every row on the current page. */
    onTogglePage: (ids: string[], select: boolean) => void;
    /** The active sort column + direction, or null for default order. */
    sort: TableSort;
    /** Cycle the sort on a column (asc → desc → off). */
    onSort: (columnId: string) => void;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const columnLabel = useColumnLabel();

    const pageIds = entries.map((record) => record.id);
    const allSelected =
        entries.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const someSelected = pageIds.some((id) => selectedIds.has(id));
    const headerChecked = allSelected
        ? true
        : someSelected
          ? 'indeterminate'
          : false;

    return (
        <div className="w-full rounded-xl border">
            <Table aria-label={intl.formatMessage(messages.caption, { label })}>
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
                        {columns.map((column) => {
                            const active = sort?.key === column.id;
                            const ariaSort = active
                                ? sort.dir === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                : 'none';
                            const label = columnLabel(column);
                            return (
                                <TableHead
                                    key={column.id}
                                    scope="col"
                                    aria-sort={ariaSort}
                                >
                                    <button
                                        type="button"
                                        className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        aria-label={intl.formatMessage(
                                            messages.sortBy,
                                            { column: label }
                                        )}
                                        onClick={() => onSort(column.id)}
                                    >
                                        {label}
                                        {active ? (
                                            sort.dir === 'asc' ? (
                                                <ArrowUp
                                                    className="size-3.5"
                                                    aria-hidden
                                                />
                                            ) : (
                                                <ArrowDown
                                                    className="size-3.5"
                                                    aria-hidden
                                                />
                                            )
                                        ) : (
                                            <ArrowUpDown
                                                className="size-3.5 text-muted-foreground/50"
                                                aria-hidden
                                            />
                                        )}
                                    </button>
                                </TableHead>
                            );
                        })}
                        {/* Trailing, non-sortable actions column. */}
                        <TableHead scope="col" className="w-10 text-right">
                            {intl.formatMessage(messages.actions)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((record) => {
                        const selected = selectedIds.has(record.id);
                        return (
                            <TableRow
                                key={record.id}
                                data-state={selected ? 'selected' : undefined}
                                onClick={() =>
                                    navigate(`${typePath}/${record.id}`)
                                }
                                className="cursor-pointer"
                            >
                                <TableCell
                                    onClick={(event) => event.stopPropagation()}
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
                                {/* Row actions — stop propagation so opening the
                                    menu doesn't trigger the row's navigation. */}
                                <TableCell
                                    className="text-right"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <CollectionRecordsRowActions
                                        record={record}
                                        typePath={typePath}
                                        publishable={publishable}
                                    />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
