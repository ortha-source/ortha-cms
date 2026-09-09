import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROTECTION_RULE } from '../../../../domain/types';
import type { ProtectedTypeRow } from '../../../../domain/types';
import { RuleEditorDialog } from './index';

const saveRule = vi.fn();
const deleteRule = vi.fn();

vi.mock('../../../../infrastructure/protectionGateway', () => ({
    httpProtectionGateway: {
        saveRule: (...args: unknown[]) => saveRule(...args),
        deleteRule: (...args: unknown[]) => deleteRule(...args)
    }
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
if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
}
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
}

const row: ProtectedTypeRow = {
    slug: 'article',
    kind: 'collection',
    label: 'Articles',
    rule: null
};

function renderDialog(
    over: Partial<Parameters<typeof RuleEditorDialog>[0]> = {}
) {
    render(
        <IntlProvider locale="en">
            <QueryClientProvider
                client={
                    new QueryClient({
                        defaultOptions: { queries: { retry: false } }
                    })
                }
            >
                <RuleEditorDialog
                    open
                    onOpenChange={() => undefined}
                    row={row}
                    workspaceId="w1"
                    memberCount={3}
                    canManage
                    {...over}
                />
            </QueryClientProvider>
        </IntlProvider>
    );
}

const toggle = () =>
    screen.getByRole('switch', { name: 'Require review before publishing' });

beforeEach(() => {
    saveRule.mockReset().mockResolvedValue(undefined);
    deleteRule.mockReset().mockResolvedValue(undefined);
});

/**
 * ADR-0017 accepts that a one-person workspace with four eyes blocks itself,
 * and requires the interface to name it **when the rule is switched on** rather
 * than a week later on the first failed publish.
 */
describe('the one-member warning', () => {
    it('appears the moment the rule is switched on', () => {
        renderDialog({ memberCount: 1 });
        expect(screen.queryByText(/Nobody could publish/)).toBeNull();

        fireEvent.click(toggle());
        expect(screen.getByText(/Nobody could publish/)).toBeTruthy();
    });

    /**
     * Rendered is not enough: somebody who just flipped a toggle is looking at
     * the toggle, not at the paragraph below it. The warning lives in a live
     * region so it is spoken rather than merely drawn.
     */
    it('is announced, not merely rendered', () => {
        renderDialog({ memberCount: 1 });
        fireEvent.click(toggle());

        const status = screen.getByRole('status');
        expect(status.textContent).toMatch(/Nobody could publish/);
    });

    it('stays away once a second person can approve', () => {
        renderDialog({ memberCount: 2 });
        fireEvent.click(toggle());
        expect(screen.queryByText(/Nobody could publish/)).toBeNull();
    });

    it('stays away when the author may approve their own version', () => {
        renderDialog({ memberCount: 1 });
        fireEvent.click(toggle());
        fireEvent.click(
            screen.getByRole('checkbox', {
                name: /author cannot approve their own version/
            })
        );
        expect(screen.queryByText(/Nobody could publish/)).toBeNull();
    });
});

describe('without protection:manage', () => {
    /**
     * Greyed-out controls say nothing to a screen reader. The refusal is a
     * sentence, and the controls that would change something are gone rather
     * than merely dimmed.
     */
    it('says so in text and offers no way to save', () => {
        renderDialog({ canManage: false });

        expect(
            screen.getByText('You can view this rule but not change it.')
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    it('leaves every control disabled', () => {
        renderDialog({ canManage: false });
        expect(toggle().hasAttribute('disabled')).toBe(true);
    });

    it('offers no way to remove a rule either', () => {
        renderDialog({
            canManage: false,
            row: {
                ...row,
                rule: {
                    ...DEFAULT_PROTECTION_RULE,
                    id: 'r1',
                    kind: 'collection',
                    slug: 'article'
                }
            }
        });
        expect(
            screen.queryByRole('button', { name: 'Remove rule' })
        ).toBeNull();
    });
});

describe('saving', () => {
    /**
     * `PUT` replaces rather than patches, so a body missing a field resets it
     * to the default. The form therefore submits all six, always — this is the
     * assertion that catches somebody "optimising" it to send only what moved.
     */
    it('submits all six fields, not only the ones that changed', async () => {
        renderDialog();
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1));
        const [address, rule] = saveRule.mock.calls[0];
        expect(address).toEqual({ kind: 'collection', slug: 'article' });
        expect(Object.keys(rule).sort()).toEqual(
            Object.keys(DEFAULT_PROTECTION_RULE).sort()
        );
        expect(rule.enabled).toBe(true);
    });

    it('clamps a count typed below the minimum', async () => {
        renderDialog();
        fireEvent.change(
            screen.getByRole('spinbutton', { name: 'Approvals needed' }),
            { target: { value: '0' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1));
        expect(saveRule.mock.calls[0][1].requiredApprovals).toBe(1);
    });

    it('offers Remove only for a type that already holds a rule', () => {
        renderDialog();
        expect(
            screen.queryByRole('button', { name: 'Remove rule' })
        ).toBeNull();
    });
});
