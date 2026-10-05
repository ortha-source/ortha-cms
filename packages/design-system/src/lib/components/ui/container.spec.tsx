import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Table2 } from 'lucide-react';

import { Button } from './button';
import { ContainerHeader, PageHeaderHost } from './container';

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

/**
 * Under a top bar the header folds away: the bar names the page, so the title
 * goes screen-reader-only and the actions move into the bar. The seam worth
 * pinning is that "folds away" never means "goes away" — a header that dropped
 * its `<h1>` with its pixels would leave every page without a heading, and the
 * page would look exactly as intended.
 */
describe('ContainerHeader under a top bar', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** A stand-in for the top bar's actions region. */
    function barHost(): HTMLElement {
        const host = document.createElement('div');
        host.setAttribute('data-testid', 'bar');
        document.body.appendChild(host);
        return host;
    }

    it('keeps its heading for assistive technology and moves its actions into the bar [design-system:I-43]', () => {
        const host = barHost();
        render(
            <PageHeaderHost host={host}>
                <ContainerHeader
                    title="Blog posts"
                    subtitle="42 records"
                    actions={<Button>Add record</Button>}
                />
            </PageHeaderHost>
        );

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.textContent).toBe('Blog posts');
        expect(heading.className).toContain('sr-only');
        expect(screen.getAllByRole('heading')).toHaveLength(1);

        // In the bar, and stepped down to the bar's density.
        const button = within(host).getByRole('button', { name: 'Add record' });
        expect(button.className).toContain('h-8');
        host.remove();
    });

    it('keeps a data subtitle on screen when asked to', () => {
        const host = barHost();
        render(
            <PageHeaderHost host={host}>
                <ContainerHeader
                    title="Endpoint"
                    subtitle="https://example.com/hook"
                    keepSubtitle
                />
            </PageHeaderHost>
        );

        expect(
            screen.getByText('https://example.com/hook').className
        ).not.toContain('sr-only');
        host.remove();
    });

    it('draws in full below the breakpoint, where the bar has no room [design-system:I-43]', () => {
        vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: true,
                    media: query,
                    onchange: null,
                    addEventListener: () => undefined,
                    removeEventListener: () => undefined,
                    addListener: () => undefined,
                    removeListener: () => undefined,
                    dispatchEvent: () => false
                }) as MediaQueryList
        );
        const host = barHost();
        render(
            <PageHeaderHost host={host}>
                <ContainerHeader
                    title="Blog posts"
                    actions={<Button>Add record</Button>}
                />
            </PageHeaderHost>
        );

        expect(
            screen.getByRole('heading', { level: 1 }).className
        ).not.toContain('sr-only');
        expect(within(host).queryByRole('button')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Add record' }).className
        ).toContain('h-9');
        host.remove();
    });
});
