import * as React from 'react';

import { cn } from '../../utils';

/**
 * Tracks whether an element's content is wider than its box — i.e. whether the
 * wrapper is actually a scroll container right now, rather than merely allowed
 * to become one.
 */
function useOverflows(element: HTMLElement | null): boolean {
    const [overflows, setOverflows] = React.useState(false);

    React.useEffect(() => {
        if (!element) {
            return;
        }
        const measure = () =>
            setOverflows(element.scrollWidth > element.clientWidth);
        measure();

        // Three things can change the answer and they need three sources.
        // The **table** grows when a column is shown or the data widens a cell
        // — the wrapper is `w-full` and does not move when that happens, so
        // observing the wrapper alone misses it. The **wrapper** changes when
        // the surrounding layout does. And `resize` catches the viewport, which
        // neither observer sees on its own.
        const observer =
            typeof ResizeObserver === 'undefined'
                ? undefined
                : new ResizeObserver(measure);
        observer?.observe(element);
        if (element.firstElementChild) {
            observer?.observe(element.firstElementChild);
        }
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [element]);

    return overflows;
}

const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
    const [wrapper, setWrapper] = React.useState<HTMLElement | null>(null);
    const overflows = useOverflows(wrapper);
    const name = props['aria-label'];
    const labelledBy = props['aria-labelledby'];

    return (
        /* A region that scrolls has to be reachable by keyboard (WCAG 2.1.1) —
           a mouse wheel is not a substitute, and a narrow viewport is exactly
           where a wide admin table stops fitting. The tab stop is taken *only*
           while the content actually overflows, because an unconditional one
           would add a stop to all nine admin tables at every viewport where
           there is nothing to scroll. `group` rather than `region`: it names
           the container for a screen reader without adding a second landmark
           beside the `<main>` the shell already provides. And a stop that is
           reached must be visible (WCAG 2.4.7) — the lesson the inset
           scrollport learned the hard way — hence the ring. */
        <div
            data-slot="table-scroll"
            ref={setWrapper}
            className={cn(
                'relative w-full overflow-auto',
                overflows &&
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none'
            )}
            tabIndex={overflows ? 0 : undefined}
            role={overflows && (name || labelledBy) ? 'group' : undefined}
            aria-label={overflows ? name : undefined}
            aria-labelledby={overflows ? labelledBy : undefined}
        >
            <table
                ref={ref}
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            />
        </div>
    );
});
Table.displayName = 'Table';

/**
 * The header is a gray pill — the same `muted` wash, and the same rounded
 * ends, as a hovered row — so a table with no rules still has its column
 * labels set apart, and every shape in it is the same shape. No line under it.
 *
 * Because the wash *is* the hover's, a hovered first row would run straight
 * into the header and read as one block. A 4px spacer row keeps them apart.
 * It is a row rather than a transparent border on the cells: a border clipped
 * out of a rounded cell's background left a notch at its corner. Hidden from
 * assistive technology, and cell-less, so it is no row to anyone counting.
 */
const TableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, ...props }, ref) => (
    <thead
        ref={ref}
        className={cn(
            '[&_th]:bg-muted [&_th:first-child]:rounded-l-lg [&_th:last-child]:rounded-r-lg',
            className
        )}
        {...props}
    >
        {children}
        <tr aria-hidden data-slot="table-header-gap" className="h-1" />
    </thead>
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
    />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tfoot
        ref={ref}
        className={cn(
            'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
            className
        )}
        {...props}
    />
));
TableFooter.displayName = 'TableFooter';

/**
 * A row draws no rule: body rows are separated by space alone, and the one
 * line in a table is the header's. What tells a row apart is the hover (and
 * selected) wash, painted on the **cells** rather than the `<tr>` so the
 * first and last can round it into a single pill — a row has no box of its
 * own to round. The wash is `muted`, a step lighter than `secondary`, because
 * a `secondary` badge (Draft, Viewer) on a `secondary` wash simply vanished.
 * A header row is untouched: its cells are `th`.
 */
const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            '[&>td]:transition-colors [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg',
            'hover:[&>td]:bg-muted data-[state=selected]:[&>td]:bg-muted',
            className
        )}
        {...props}
    />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = 'col', ...props }, ref) => (
    // `scope` defaults to the column, overridable for a row header. Browsers
    // infer the association from position otherwise, which is right for a flat
    // single-header grid and silently wrong the moment a `colspan`, a row
    // header or a second header row appears.
    <th
        ref={ref}
        scope={scope}
        className={cn(
            'h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
            className
        )}
        {...props}
    />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn(
            'px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
            className
        )}
        {...props}
    />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
    HTMLTableCaptionElement,
    React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
    <caption
        ref={ref}
        className={cn('mt-4 text-sm text-muted-foreground', className)}
        {...props}
    />
));
TableCaption.displayName = 'TableCaption';

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption
};
