import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from './table';

/**
 * QA ORT-49 · F19, EC-06 — `🐞 BUG-design-system-04` / `♿ A11Y-design-system-03/04`.
 *
 * The nine admin tables all inherit this wrapper, and the defect only exists at
 * a viewport where the table overflows — which is exactly why every axe scan in
 * `admin-e2e` (all at 1280×720) reports it clean. jsdom reports zero for every
 * layout metric, so overflow is simulated by defining the two properties the
 * component reads.
 */

/** Pretend the wrapper is `content`px wide inside a `box`px viewport slot. */
function fakeOverflow(element: HTMLElement, content: number, box: number) {
    Object.defineProperty(element, 'scrollWidth', {
        configurable: true,
        value: content
    });
    Object.defineProperty(element, 'clientWidth', {
        configurable: true,
        value: box
    });
}

function renderTable(props: React.ComponentProps<typeof Table> = {}) {
    const view = render(
        <Table aria-label="Members" {...props}>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell>Grace</TableCell>
                    <TableCell>Admin</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
    const table = screen.getByRole('table');
    return { ...view, table, wrapper: table.parentElement as HTMLElement };
}

describe('Table', () => {
    it('renders a real table with header cells', () => {
        renderTable();
        expect(
            screen.getAllByRole('columnheader').map((c) => c.textContent)
        ).toEqual(['Name', 'Role']);
    });

    // A11Y-design-system-03 — association must come from markup, not from the
    // browser guessing at position. The guess is right for today's flat grids
    // and wrong the moment a consumer adds a colspan.
    it('scopes header cells to their column', () => {
        renderTable();
        for (const cell of screen.getAllByRole('columnheader')) {
            expect(cell.getAttribute('scope')).toBe('col');
        }
    });

    it('lets a consumer override the scope', () => {
        render(
            <Table>
                <TableBody>
                    <TableRow>
                        <TableHead scope="row">Grace</TableHead>
                        <TableCell>Admin</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );
        expect(screen.getByRole('rowheader').getAttribute('scope')).toBe('row');
    });

    // EC-06.
    it('renders the header alone when there are no rows', () => {
        render(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody />
            </Table>
        );
        expect(screen.getAllByRole('row')).toHaveLength(1);
    });

    // BUG-design-system-04 / A11Y-design-system-04 — a region that scrolls has
    // to be reachable by keyboard (WCAG 2.1.1); a wheel is not a substitute.
    it('makes the scroll container a tab stop once it overflows', () => {
        const { wrapper } = renderTable();

        expect(wrapper.getAttribute('tabindex')).toBeNull();

        act(() => {
            fakeOverflow(wrapper, 900, 400);
            window.dispatchEvent(new Event('resize'));
        });

        expect(wrapper.getAttribute('tabindex')).toBe('0');
    });

    it('names the scroll region from the table it wraps', () => {
        const { wrapper } = renderTable();

        act(() => {
            fakeOverflow(wrapper, 900, 400);
            window.dispatchEvent(new Event('resize'));
        });

        expect(wrapper.getAttribute('role')).toBe('group');
        expect(wrapper.getAttribute('aria-label')).toBe('Members');
    });

    // A tab stop nobody can see is the 2.4.7 half of the same lesson the
    // sidebar scrollport learned: never take a stop without a visible ring.
    it('gives the scroll container a focus ring when it is focusable', () => {
        const { wrapper } = renderTable();

        act(() => {
            fakeOverflow(wrapper, 900, 400);
            window.dispatchEvent(new Event('resize'));
        });

        expect(wrapper.className).toContain('focus-visible:ring-2');
    });

    it('gives up the tab stop again when the overflow goes away', () => {
        const { wrapper } = renderTable();

        act(() => {
            fakeOverflow(wrapper, 900, 400);
            window.dispatchEvent(new Event('resize'));
        });
        expect(wrapper.getAttribute('tabindex')).toBe('0');

        act(() => {
            fakeOverflow(wrapper, 400, 400);
            window.dispatchEvent(new Event('resize'));
        });
        expect(wrapper.getAttribute('tabindex')).toBeNull();
    });

    // The wrapper is `w-full`, so showing a column does not change *its* box —
    // only the table's. Observing the wrapper alone would miss the commonest
    // way a table starts overflowing.
    it('observes the table as well as its wrapper', () => {
        const observed: unknown[] = [];
        const original = globalThis.ResizeObserver;
        globalThis.ResizeObserver = class {
            observe(target: unknown) {
                observed.push(target);
            }
            unobserve() {
                return undefined;
            }
            disconnect() {
                return undefined;
            }
        } as unknown as typeof ResizeObserver;

        try {
            const { table, wrapper } = renderTable();
            expect(observed).toContain(wrapper);
            expect(observed).toContain(table);
        } finally {
            globalThis.ResizeObserver = original;
        }
    });

    it('adds no tab stop to a table that fits', () => {
        const { wrapper } = renderTable();

        act(() => {
            fakeOverflow(wrapper, 400, 400);
            window.dispatchEvent(new Event('resize'));
        });

        expect(wrapper.getAttribute('tabindex')).toBeNull();
        expect(wrapper.getAttribute('role')).toBeNull();
    });
});
