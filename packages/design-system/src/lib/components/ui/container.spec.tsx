import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table2 } from 'lucide-react';

import { ContainerHeader } from './container';

/**
 * ORT-202 — the page heading, and the mark that may lead it.
 *
 * The two pages that used to draw their own heading (the records list and the
 * entry editor) now come through here, so this is the one place the admin's
 * `<h1>` is defined. The seam worth pinning is the icon: it is a decoration
 * beside a heading, and the failure mode is silent — a tile that joins the
 * accessible name makes every records page announce "table Blog posts", which
 * looks identical on screen and no page test would notice.
 */
describe('ContainerHeader', () => {
    it('renders the title as the page heading', () => {
        render(<ContainerHeader title="Blog posts" />);

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Blog posts'
        );
    });

    it('keeps the icon out of the accessibility tree [design-system:I-42]', () => {
        const { container } = render(
            <ContainerHeader
                title="Blog posts"
                icon={<Table2 className="size-4" />}
            />
        );

        // The tile is hidden, and the heading is still only its own words.
        expect(container.querySelector('[aria-hidden]')).not.toBeNull();
        expect(
            screen.getByRole('heading', { name: 'Blog posts' })
        ).toBeTruthy();
    });

    it('renders no tile when no icon is given', () => {
        const { container } = render(<ContainerHeader title="Webhooks" />);

        expect(container.querySelector('[aria-hidden]')).toBeNull();
    });

    it('stays a single heading with a subtitle and actions beside it [design-system:I-42]', () => {
        render(
            <ContainerHeader
                title="Blog posts"
                icon={<Table2 className="size-4" />}
                subtitle="42 records"
                actions={<button type="button">Add record</button>}
            />
        );

        expect(screen.getAllByRole('heading')).toHaveLength(1);
        expect(screen.getByText('42 records')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add record' })).toBeTruthy();
    });
});
