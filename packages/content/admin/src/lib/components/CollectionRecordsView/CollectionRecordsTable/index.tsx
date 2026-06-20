import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
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
 * The whole row links to the entry's detail stub; the first cell additionally
 * holds a real `<a>` so keyboard users get a focusable target (mirrors the
 * Members table). Header cells carry `scope="col"` and the table an `aria-label`.
 */
export function CollectionRecordsTable({
    label,
    entries,
    columns,
    typePath
}: {
    /** The content type's display label, for the table caption. */
    label: string;
    /** The page of records to render. */
    entries: EntryRecord[];
    /** The visible columns, in order. */
    columns: EntryColumn[];
    /** Absolute path to this type, e.g. `/workspaces/:id/content/:typeName`. */
    typePath: string;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const columnLabel = useColumnLabel();

    return (
        <div className="rounded-xl border">
            <Table
                aria-label={intl.formatMessage(messages.caption, { label })}
            >
                <TableHeader>
                    <TableRow>
                        {columns.map((column) => (
                            <TableHead key={column.id} scope="col">
                                {columnLabel(column)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((record) => (
                        <TableRow
                            key={record.id}
                            onClick={() =>
                                navigate(`${typePath}/${record.id}`)
                            }
                            className="cursor-pointer"
                        >
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
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
