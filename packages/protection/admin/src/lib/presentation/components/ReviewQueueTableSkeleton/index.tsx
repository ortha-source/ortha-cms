import {
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';

/** Placeholder widths per column, in the table's own order. */
const HEAD_WIDTHS = ['w-20', 'w-16', 'w-20', 'w-24', 'w-16', 'w-20'];
const CELL_WIDTHS = ['w-40', 'w-20', 'w-28', 'w-32', 'w-24', 'w-28'];

/**
 * The review queue's table while it loads — the same card, the same six
 * columns — so the page does not jump from a grey block to a table when the
 * rows land. Purely visual: the caller wraps it in the region that announces
 * the loading state.
 */
export function ReviewQueueTableSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div aria-hidden>
            <Table>
                <TableHeader>
                    <TableRow>
                        {HEAD_WIDTHS.map((width, index) => (
                            <TableHead key={index}>
                                <Skeleton className={`h-4 ${width}`} />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, row) => (
                        <TableRow key={row}>
                            {CELL_WIDTHS.map((width, index) => (
                                <TableCell key={index}>
                                    <Skeleton className={`h-4 ${width}`} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
