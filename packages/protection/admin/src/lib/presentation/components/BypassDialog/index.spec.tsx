import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryReview } from '../../../domain/types';
import { BypassDialog } from './index';

const bypassPublish = vi.fn();

vi.mock('../../../infrastructure/protectionGateway', () => ({
    httpProtectionGateway: {
        bypassPublish: (...args: unknown[]) => bypassPublish(...args)
    }
}));

vi.mock('@orthacms/content-admin', () => ({
    refreshEntryCaches: () => Promise.resolve()
}));

// jsdom implements none of the browser APIs Radix's dialog reaches for.
if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}
if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    } as unknown as typeof ResizeObserver;
}

const scope = {
    workspaceId: 'ws',
    typeName: 'article',
    entryId: 'e1',
    updatedAt: '2026-09-09T10:00:00.000Z'
};

const review: EntryReview = {
    protected: true,
    required: 2,
    given: 0,
    stale: 0,
    changesRequested: 0,
    blocked: true,
    bypassable: true,
    headRevisionId: 'rev-7',
    headRevisionNumber: 7,
    callerWroteHead: false,
    approvals: [],
    request: null
};

function draw() {
    const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={client}>
            <IntlProvider locale="en">
                <BypassDialog
                    open
                    onOpenChange={() => undefined}
                    scope={scope}
                    review={review}
                />
            </IntlProvider>
        </QueryClientProvider>
    );
}

const confirm = () => screen.getByRole('button', { name: /publish anyway/i });

describe('BypassDialog', () => {
    beforeEach(() => bypassPublish.mockReset());

    it('says how far short the count is', () => {
        draw();

        expect(screen.getByText(/needs 2 approvals, and has 0/i)).toBeTruthy();
    });

    /** Said before the click, not after it. */
    it('names the log row the bypass will write, up front', () => {
        draw();

        expect(screen.getByText(/entry\.publish_bypassed/)).toBeTruthy();
    });

    /**
     * The two halves of one decision: an empty reason must not publish, and the
     * refusal must be something a person *hears*. A disabled button would do the
     * first and none of the second.
     */
    it('refuses an empty reason without publishing, and says why', () => {
        draw();

        expect(confirm().hasAttribute('disabled')).toBe(false);
        fireEvent.click(confirm());

        expect(bypassPublish).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toMatch(
            /reason is required/i
        );
    });

    it('treats whitespace as empty', () => {
        draw();

        fireEvent.change(screen.getByLabelText(/reason/i), {
            target: { value: '   ' }
        });
        fireEvent.click(confirm());

        expect(bypassPublish).not.toHaveBeenCalled();
    });

    it('publishes with the trimmed reason once one is given', async () => {
        bypassPublish.mockResolvedValue(undefined);
        draw();

        fireEvent.change(screen.getByLabelText(/reason/i), {
            target: { value: '  numbers corrected before the send  ' }
        });
        fireEvent.click(confirm());

        // `mutate` schedules; the call lands on the next microtask.
        await waitFor(() => expect(bypassPublish).toHaveBeenCalled());
        expect(bypassPublish).toHaveBeenCalledWith({
            typeName: 'article',
            entryId: 'e1',
            bypassReason: 'numbers corrected before the send'
        });
    });

    it('labels the reason field rather than relying on its placeholder', () => {
        draw();

        expect(screen.getByLabelText(/reason/i)).toBeTruthy();
    });
});
