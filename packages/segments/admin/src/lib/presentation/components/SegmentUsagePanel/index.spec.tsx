import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    useSegmentUsage,
    type SegmentUsageResult
} from '../../../application/hooks';
import type { Segment } from '../../../domain/types';
import {
    namedInFilter,
    USAGE_STATE,
    type WorkspaceUsageItem
} from '../../../domain/usage';
import { SegmentUsagePanel } from './index';

vi.mock('../../../application/hooks', () => ({ useSegmentUsage: vi.fn() }));
const usage = vi.mocked(useSegmentUsage);

const ACME: Segment = {
    id: 'seg-acme',
    key: 'acme',
    label: 'Acme Corp',
    tags: ['acme'],
    workspaceIds: [],
    usageCount: 2
};

const item = (
    entryId: string,
    title: string,
    state: WorkspaceUsageItem['state'],
    over: Partial<WorkspaceUsageItem> = {}
): WorkspaceUsageItem => ({
    entryId,
    title,
    state,
    typeSlug: 'article',
    typeLabel: 'Article',
    locale: null,
    trashed: false,
    workspaceId: 'ws_marketing',
    workspaceName: 'Marketing site',
    ...over
});

function answered(
    items: WorkspaceUsageItem[],
    over: Partial<SegmentUsageResult> = {}
): SegmentUsageResult {
    return {
        items,
        total: items.length,
        truncated: false,
        enabled: true,
        isPending: false,
        isError: false,
        refetch: vi.fn(),
        ...over
    };
}

function draw(segment: Segment = ACME) {
    return render(
        <IntlProvider locale="en">
            <MemoryRouter>
                <SegmentUsagePanel segment={segment} />
            </MemoryRouter>
        </IntlProvider>
    );
}

describe('SegmentUsagePanel', () => {
    beforeEach(() => vi.clearAllMocks());

    it('names each entry, links it, and says whether the audience can see it', () => {
        usage.mockReturnValue(
            answered([
                item('e1', 'Enterprise pricing', USAGE_STATE.Allow),
                item('e3', 'Competitor comparison', USAGE_STATE.Deny)
            ])
        );
        draw();

        expect(
            screen.getByRole('heading', { name: 'Used by 2 entries' })
        ).toBeTruthy();
        const pricing = screen.getByRole('link', {
            name: 'Enterprise pricing'
        });
        expect(pricing.getAttribute('href')).toBe(
            '/workspaces/ws_marketing/content/article/e1'
        );
        const rows = screen.getAllByRole('listitem');
        expect(rows[0].textContent).toContain('Can see');
        expect(rows[1].textContent).toContain('Cannot see');
    });

    it('opens the records list filtered to the audience', () => {
        usage.mockReturnValue(
            answered([item('e1', 'Enterprise pricing', USAGE_STATE.Allow)])
        );
        draw();

        const link = screen.getByRole('link', { name: 'Open in records' });
        const url = new URL(link.getAttribute('href') ?? '', 'http://x');
        expect(url.pathname).toBe('/workspaces/ws_marketing/content/article');
        expect(url.searchParams.get('filter')).toBe(namedInFilter('seg-acme'));
    });

    it('offers a menu of records lists when the entries span types', () => {
        usage.mockReturnValue(
            answered([
                item('e1', 'Enterprise pricing', USAGE_STATE.Allow),
                item('e2', 'Pricing', USAGE_STATE.Allow, {
                    typeSlug: 'page',
                    typeLabel: 'Page'
                })
            ])
        );
        draw();

        expect(
            screen.getByRole('button', { name: 'Open in records' })
        ).toBeTruthy();
    });

    it('says the audience is not used yet', () => {
        usage.mockReturnValue(answered([]));
        draw({ ...ACME, usageCount: 0 });

        expect(
            screen.getByRole('heading', { name: 'Not used yet' })
        ).toBeTruthy();
        expect(
            screen.getByText(/changing its tags changes nothing readers see/)
        ).toBeTruthy();
    });

    it('counts what sits in workspaces the caller cannot open', () => {
        usage.mockReturnValue(
            answered([item('e1', 'Enterprise pricing', USAGE_STATE.Allow)])
        );
        draw({ ...ACME, usageCount: 4 });

        expect(
            screen.getByText('3 more entries in workspaces you can’t open.')
        ).toBeTruthy();
    });

    it('offers a retry when a read fails, rather than claiming it is unused', () => {
        const refetch = vi.fn();
        usage.mockReturnValue(answered([], { isError: true, refetch }));
        draw();

        expect(screen.getByRole('alert').textContent).toContain(
            'Couldn’t load the entries that use it.'
        );
        screen.getByRole('button', { name: 'Try again' }).click();
        expect(refetch).toHaveBeenCalled();
    });

    it('renders nothing for a caller who may not read content', () => {
        usage.mockReturnValue(answered([], { enabled: false }));
        const { container } = draw();
        expect(container.innerHTML).toBe('');
    });
});
