import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    article,
    author,
    envelopeOf,
    home
} from '../../../../testing/document';
import { httpSchemaGateway } from '../../../infrastructure/httpSchemaGateway';
import { ContentModelPage } from './index';

// The gateway, not the hook, is mocked: "no request without access" is a claim
// about a call that must not happen, which only the gateway can witness.
vi.mock('../../../infrastructure/httpSchemaGateway', () => ({
    httpSchemaGateway: { document: vi.fn() }
}));
vi.mock('@orthacms/identity-admin', () => ({ useHasPermission: vi.fn() }));
// The top bar needs the shell's page-chrome context, which is not under test.
vi.mock('@orthacms/shell-admin', () => ({ PageTopBar: () => null }));

const fetchDocument = vi.mocked(httpSchemaGateway.document);
const hasPermission = vi.mocked(useHasPermission);

function renderPage(path = '/content-model') {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return render(
        <QueryClientProvider client={client}>
            <IntlProvider locale="en">
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route
                            path="/content-model/:typeName?"
                            element={<ContentModelPage />}
                        />
                    </Routes>
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
}

describe('ContentModelPage', () => {
    beforeEach(() => {
        fetchDocument.mockReset();
        hasPermission.mockReturnValue(true);
    });

    it('without content:read, says so and sends no request', () => {
        hasPermission.mockReturnValue(false);
        renderPage();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content model' })
        ).toBeTruthy();
        expect(
            screen.getByText('You don’t have access to the content model')
        ).toBeTruthy();
        expect(fetchDocument).not.toHaveBeenCalled();
    });

    it('while loading, keeps the real header and announces one skeleton region', () => {
        fetchDocument.mockReturnValue(new Promise(() => undefined));
        renderPage();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content model' })
        ).toBeTruthy();
        const status = screen.getAllByRole('status');
        expect(status).toHaveLength(1);
        expect(status[0].getAttribute('aria-busy')).toBe('true');
        expect(
            within(status[0]).getByText('Loading the content model…')
        ).toBeTruthy();
    });

    it('on failure, shows an error with a retry rather than an empty model', async () => {
        fetchDocument
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce(envelopeOf([article]));
        renderPage();
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('Couldn’t load the content model');
        expect(screen.queryByText('No content types yet')).toBeNull();

        fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
        expect(
            await screen.findByRole('heading', { level: 2, name: 'Articles' })
        ).toBeTruthy();
    });

    it('with no types, shows the empty state — a fresh app, not an error', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([]));
        renderPage();
        expect(await screen.findByText('No content types yet')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('lists collections and pages in the rail, the first type selected by default', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([article, author, home]));
        renderPage();
        const rail = await screen.findByRole('navigation', {
            name: 'Content types'
        });
        expect(
            within(rail).getByRole('heading', { name: 'Collections' })
        ).toBeTruthy();
        expect(
            within(rail).getByRole('heading', { name: 'Pages' })
        ).toBeTruthy();
        const current = within(rail).getByRole('link', { current: 'page' });
        expect(current.getAttribute('href')).toBe('/content-model/article');
        expect(
            screen.getByRole('heading', { level: 2, name: 'Articles' })
        ).toBeTruthy();
    });

    it('selects the type named in the URL, and falls back to the first for an unknown one', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([article, author, home]));
        const { unmount } = renderPage('/content-model/home');
        expect(
            await screen.findByRole('heading', { level: 2, name: 'Home' })
        ).toBeTruthy();
        unmount();

        renderPage('/content-model/removed');
        expect(
            await screen.findByRole('heading', { level: 2, name: 'Articles' })
        ).toBeTruthy();
    });

    it('says why the page is read-only', async () => {
        fetchDocument.mockResolvedValue(
            envelopeOf([article], {
                editable: false,
                reason: 'production',
                restart: 'watch'
            })
        );
        renderPage();
        expect(await screen.findByText(/runs in production/)).toBeTruthy();
    });

    it('on an editable server, explains only why a hand-written type stays read-only', async () => {
        fetchDocument.mockResolvedValue(
            envelopeOf([article, { ...author, origin: 'builder' }], {
                editable: true,
                restart: 'watch'
            })
        );
        const { unmount } = renderPage('/content-model/article');
        expect(await screen.findByText(/is written by hand in/)).toBeTruthy();
        expect(
            screen.getByText('src/content/collections/article.ts')
        ).toBeTruthy();
        expect(screen.queryByText(/Editing is off/)).toBeNull();
        unmount();

        renderPage('/content-model/author');
        await screen.findByRole('heading', { level: 2, name: 'author' });
        expect(screen.queryByText(/is written by hand in/)).toBeNull();
    });

    it('draws fields under the built-in tabs: General by rank then groups, Relations, Media', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([article]));
        renderPage();
        const general = await screen.findByRole('region', { name: 'General' });
        const names = within(general)
            .getAllByRole('listitem')
            .map((item) => item.querySelector('.font-mono')?.textContent);
        expect(names).toEqual(['title', 'kind', 'body', 'slug']);
        expect(
            within(general).getByRole('button', { name: /SEO/ })
        ).toBeTruthy();
        expect(within(general).getByText('starts folded')).toBeTruthy();

        const relations = screen.getByRole('region', { name: 'Relations' });
        expect(within(relations).getByText('author')).toBeTruthy();
        expect(within(relations).getByText('→ author')).toBeTruthy();
        expect(
            within(screen.getByRole('region', { name: 'Media' })).getByText(
                'Multiple'
            )
        ).toBeTruthy();
    });

    it('leaves out a tab with nothing on it', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([author]));
        renderPage();
        await screen.findByRole('region', { name: 'General' });
        expect(screen.queryByRole('region', { name: 'Relations' })).toBeNull();
        expect(screen.queryByRole('region', { name: 'Media' })).toBeNull();
    });

    it('states each type flag in words', async () => {
        fetchDocument.mockResolvedValue(envelopeOf([article, author]));
        renderPage('/content-model/author');
        await screen.findByRole('heading', { level: 2, name: 'author' });
        await waitFor(() =>
            expect(screen.getByText(/Draft & publish/).textContent).toContain(
                'off'
            )
        );
    });
});
