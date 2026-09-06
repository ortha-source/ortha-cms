import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertTitle } from './alert';
import { Card, CardHeader, CardTitle } from './card';
import { Empty, EmptyHeader, EmptyTitle } from './empty';

/**
 * ORT-168 — the three "title" slots, none of which may be a heading by default.
 *
 * A shared component cannot know its rank. `AlertTitle` used to hardcode
 * `<h5>`, so every banner on a page whose own heading is an `<h1>` jumped four
 * levels and told a screen-reader user it was subordinate to sections that do
 * not exist. `CardTitle` and `EmptyTitle` sit in exactly the same position: a
 * card is an `<h3>` on a dashboard of many and the page's `<h1>` on an empty
 * one, and only the page knows which.
 *
 * So the default is a `<div>` and the page opts in. That is a rule with no
 * runtime consequence — nothing throws, nothing looks different, and the
 * regression shape is a `shadcn add` pulling the upstream heading back in — so
 * the tags are asserted here rather than reviewed.
 */
describe('title slots', () => {
    it('renders an alert title as a div, not a heading [design-system:I-14]', () => {
        render(
            <Alert>
                <AlertTitle>Import failed</AlertTitle>
            </Alert>
        );

        expect(screen.queryAllByRole('heading')).toHaveLength(0);
        expect(screen.getByText('Import failed').tagName).toBe('DIV');
    });

    it('renders a card title as a div, not a heading [design-system:I-14]', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Recent activity</CardTitle>
                </CardHeader>
            </Card>
        );

        expect(screen.queryAllByRole('heading')).toHaveLength(0);
        expect(screen.getByText('Recent activity').tagName).toBe('DIV');
    });

    it('renders an empty-state title as a div, not a heading [design-system:I-14]', () => {
        render(
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No entries yet</EmptyTitle>
                </EmptyHeader>
            </Empty>
        );

        expect(screen.queryAllByRole('heading')).toHaveLength(0);
        expect(screen.getByText('No entries yet').tagName).toBe('DIV');
    });

    it('lets the page choose the card title rank through asChild [design-system:I-14]', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle asChild>
                        <h2>Recent activity</h2>
                    </CardTitle>
                </CardHeader>
            </Card>
        );

        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading.textContent).toBe('Recent activity');
        // `Slot` has to merge, not replace: the page picked the rank and the
        // library still owns the type scale.
        expect(heading.className).toContain('font-semibold');
    });

    it('lets the page choose the empty-state title rank through asChild [design-system:I-14]', () => {
        render(
            <Empty>
                <EmptyHeader>
                    <EmptyTitle asChild>
                        <h1>Content Library</h1>
                    </EmptyTitle>
                </EmptyHeader>
            </Empty>
        );

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.textContent).toBe('Content Library');
        expect(heading.getAttribute('data-slot')).toBe('empty-title');
    });

    it('lets the page choose the alert title rank by nesting one [design-system:I-14]', () => {
        // `AlertTitle` takes no `asChild` — it stays the labelled wrapper the
        // banner points `aria-labelledby` at, and a page that genuinely wants
        // a heading renders one inside. Same outcome, different mechanism from
        // the two above.
        render(
            <Alert>
                <AlertTitle>
                    <h2>Import failed</h2>
                </AlertTitle>
            </Alert>
        );

        expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
        expect(
            screen.getByRole('alert', { name: 'Import failed' })
        ).toBeTruthy();
    });
});
