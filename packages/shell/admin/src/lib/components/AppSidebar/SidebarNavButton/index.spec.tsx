import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar, SidebarMenu, SidebarProvider } from '@orthacms/design-system';
import type { SidebarItem } from '../../../slots/sidebarSlots';
import type { NavBadge } from '../../NavBadges';
import { SidebarNavButton } from './index';

const identity = vi.hoisted(() => ({
    useHasPermission: vi.fn((_permission: string) => true)
}));

vi.mock('@orthacms/identity-admin', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@orthacms/identity-admin')>();
    return { ...actual, useHasPermission: identity.useHasPermission };
});

function StubIcon({ className }: { className?: string }) {
    return <svg aria-hidden className={className} />;
}

const UNREAD: NavBadge = { count: 6, tone: 'strong', label: '6 unread' };

function inbox(
    useBadge: SidebarItem['useBadge'],
    permission?: string
): SidebarItem {
    return {
        labelId: 'test.inbox',
        defaultLabel: 'Inbox',
        to: '/inbox',
        group: 'overview',
        order: 15,
        icon: StubIcon,
        useBadge,
        ...(permission ? { permission } : {})
    };
}

function renderRow(item: SidebarItem) {
    render(
        <IntlProvider locale="en">
            <MemoryRouter initialEntries={['/']}>
                <SidebarProvider>
                    <Sidebar>
                        <SidebarMenu>
                            <SidebarNavButton item={item} />
                        </SidebarMenu>
                    </Sidebar>
                </SidebarProvider>
            </MemoryRouter>
        </IntlProvider>
    );
}

/**
 * A row's count is reported by the contributing plugin and drawn by the row.
 * The two rules a browser cannot attribute: the words reach the link's name
 * (the chip is decoration), and a row the reader may not see never asks.
 */
describe('SidebarNavButton badge', () => {
    beforeEach(() => {
        identity.useHasPermission.mockReset();
        identity.useHasPermission.mockReturnValue(true);
    });

    it('puts the count in the link name and draws the chip beside it', () => {
        renderRow(inbox(() => UNREAD));

        const link = screen.getByRole('link', { name: /^Inbox ?, 6 unread$/ });
        expect(link).toBeTruthy();
        // The chip is outside the link and hidden from assistive technology.
        const chip = screen.getByText('6');
        expect(link.contains(chip)).toBe(false);
        expect(chip.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('renders the plain row when the hook has nothing to say', () => {
        renderRow(inbox(() => null));

        expect(screen.getByRole('link', { name: 'Inbox' })).toBeTruthy();
    });

    it('still calls the hook for a gated-out row, telling it not to fetch', () => {
        identity.useHasPermission.mockReturnValue(false);
        const useBadge = vi.fn((_enabled: boolean) => UNREAD);

        renderRow(inbox(useBadge, 'inbox:read'));

        expect(useBadge).toHaveBeenCalledWith(false);
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('caps a long count at 99+', () => {
        renderRow(inbox(() => ({ ...UNREAD, count: 140 })));

        expect(screen.getByText('99+')).toBeTruthy();
    });
});
