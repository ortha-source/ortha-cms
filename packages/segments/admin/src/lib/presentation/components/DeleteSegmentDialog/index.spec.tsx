import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    useSegmentUsage,
    type SegmentUsageResult
} from '../../../application/hooks';
import type { Segment } from '../../../domain/types';
import { USAGE_STATE, type WorkspaceUsageItem } from '../../../domain/usage';
import { DeleteSegmentDialog } from './index';

vi.mock('../../../application/hooks', () => ({ useSegmentUsage: vi.fn() }));
const usage = vi.mocked(useSegmentUsage);

const ACME: Segment = {
    id: 'seg-acme',
    key: 'acme',
    label: 'Acme Corp',
    tags: ['acme'],
    workspaceIds: [],
    usageCount: 3
};

const item = (
    entryId: string,
    title: string,
    state: WorkspaceUsageItem['state']
): WorkspaceUsageItem => ({
    entryId,
    title,
    state,
    typeSlug: 'article',
    typeLabel: 'Article',
    locale: null,
    trashed: false,
    workspaceId: 'ws_marketing',
    workspaceName: 'Marketing site'
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
            <DeleteSegmentDialog
                segment={segment}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />
        </IntlProvider>
    );
}

const dialogText = () => screen.getByRole('dialog').textContent ?? '';

describe('DeleteSegmentDialog', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lists who will see what: allowed entries lose the restriction, refused ones open again', () => {
        usage.mockReturnValue(
            answered([
                item('e1', 'Enterprise pricing', USAGE_STATE.Allow),
                item('e2', 'Acme onboarding guide', USAGE_STATE.Allow),
                item('e3', 'Competitor comparison', USAGE_STATE.Deny)
            ])
        );
        draw();

        expect(
            screen.getByRole('heading', { name: 'Delete “Acme Corp”?' })
        ).toBeTruthy();
        expect(dialogText()).toContain(
            '3 entries name this audience. After deleting:'
        );
        expect(dialogText()).toContain(
            'Enterprise pricing and Acme onboarding guide — no longer shown to Acme Corp readers only; they follow their other rules, or become public'
        );
        expect(dialogText()).toContain(
            'Competitor comparison — Acme Corp readers can see it again'
        );
        expect(
            screen.getByRole('button', { name: 'Delete audience' })
        ).toBeTruthy();
    });

    it('counts the entries in workspaces the caller cannot open', () => {
        usage.mockReturnValue(
            answered([item('e1', 'Enterprise pricing', USAGE_STATE.Allow)])
        );
        draw();

        expect(dialogText()).toContain('3 entries name this audience');
        expect(dialogText()).toContain(
            '2 more entries in workspaces you can’t open will change the same way.'
        );
    });

    it('says nothing changes when nothing names it', () => {
        usage.mockReturnValue(answered([]));
        draw({ ...ACME, usageCount: 0 });

        expect(dialogText()).toContain(
            'No entry names it, so nothing any reader sees will change.'
        );
    });

    it('falls back to the rule in words when the entries cannot be read', () => {
        usage.mockReturnValue(answered([], { isError: true }));
        draw();

        expect(dialogText()).toContain('It is removed from every entry');
    });

    it('says it is checking while the entries load', () => {
        usage.mockReturnValue(answered([], { isPending: true }));
        draw();

        expect(screen.getByRole('status').textContent).toBe(
            'Checking which entries name it…'
        );
    });
});
