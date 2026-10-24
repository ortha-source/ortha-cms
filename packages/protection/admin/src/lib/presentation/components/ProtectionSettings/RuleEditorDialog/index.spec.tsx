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
            screen.getByRole('switch', {
                name: /author can’t approve their own changes/
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

    it('sends the preset that was picked', async () => {
        renderDialog();
        fireEvent.click(screen.getByRole('radio', { name: '3' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1));
        expect(saveRule.mock.calls[0][1].requiredApprovals).toBe(3);
    });

    it('reveals a number input behind Other…, and clamps what is typed', async () => {
        renderDialog();
        expect(
            screen.queryByRole('spinbutton', { name: 'Number of approvals' })
        ).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'Other…' }));
        fireEvent.change(
            screen.getByRole('spinbutton', { name: 'Number of approvals' }),
            { target: { value: '0' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1));
        expect(saveRule.mock.calls[0][1].requiredApprovals).toBe(1);
    });

    it('opens on Other… for a count beyond the presets', () => {
        renderDialog({
            row: {
                ...row,
                rule: {
                    ...DEFAULT_PROTECTION_RULE,
                    enabled: true,
                    requiredApprovals: 5,
                    id: 'r1',
                    kind: 'collection',
                    slug: 'article'
                }
            }
        });
        expect(
            screen
                .getByRole('radio', { name: 'Other…' })
                .getAttribute('aria-checked')
        ).toBe('true');
        expect(
            (
                screen.getByRole('spinbutton', {
                    name: 'Number of approvals'
                }) as HTMLInputElement
            ).value
        ).toBe('5');
    });

    it('offers Remove only for a type that already holds a rule', () => {
        renderDialog();
        expect(
            screen.queryByRole('button', { name: 'Remove rule' })
        ).toBeNull();
    });
});

/**
 * The rule read back as one sentence — the redesign's point: what the switches
 * do together, which no single switch says.
 */
describe('the In short sentence', () => {
    const sentence = () =>
        screen.getByText('In short:').parentElement?.textContent ?? '';

    it('says a type with the rule off publishes without review', () => {
        renderDialog();
        expect(sentence()).toBe(
            'In short: a record in Articles publishes without review.'
        );
    });

    it('reads the board’s rule back: two approvals from others, admins override', () => {
        renderDialog();
        fireEvent.click(toggle());
        fireEvent.click(screen.getByRole('radio', { name: '2' }));
        expect(sentence()).toBe(
            'In short: a record in Articles needs 2 approvals from people other than its author; admins can override.'
        );
    });

    it('follows every switch as it moves', () => {
        renderDialog();
        fireEvent.click(toggle());
        fireEvent.click(
            screen.getByRole('switch', {
                name: /author can’t approve their own changes/
            })
        );
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Keep approvals across new saves'
            })
        );
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Admins may publish without review'
            })
        );
        expect(sentence()).toBe(
            'In short: a record in Articles needs 1 approval; its author’s own approval counts; approvals stay after a new save.'
        );
    });
});
