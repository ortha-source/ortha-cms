import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sidebar, SidebarInset, SidebarProvider } from './sidebar';
import { TopBar, TopBarActions, TopBarIcon } from './top-bar';

/**
 * QA ORT-49 · F31/F32, EC-26 — the portal hoist.
 *
 * A page writes `<TopBar>` first in its tree and knows nothing about the fact
 * that it ends up somewhere else in the DOM. That indirection is exactly what
 * a page test cannot assert without reaching for internals, and it has three
 * distinct outcomes — hoisted, in place, or deliberately nothing — keyed on a
 * context value that is `HTMLElement | null | undefined`.
 */
const bar = () => document.querySelector('[data-slot="top-bar"]');
const strip = () => document.querySelector('[data-slot="sidebar-inset-bar"]');

describe('TopBar', () => {
    it('hoists itself into the inset strip, above the scrollport', () => {
        render(
            <SidebarProvider>
                <SidebarInset>
                    <TopBar>
                        <span>Members</span>
                    </TopBar>
                </SidebarInset>
            </SidebarProvider>
        );

        expect(bar()?.parentElement).toBe(strip());
        expect(screen.getByText('Members')).toBeTruthy();
    });

    // EC-26: `host === undefined` means there is no inset at all — a public
    // page — and the bar renders where it was written.
    it('renders in place when there is no inset above it', () => {
        const { container } = render(
            <TopBar>
                <span>Sign in</span>
            </TopBar>
        );

        expect(container.querySelector('[data-slot="top-bar"]')).toBeTruthy();
    });

    it('leads with a reveal trigger only once the sidebar is hidden', () => {
        render(
            <SidebarProvider>
                <Sidebar collapsible="offcanvas" />
                <SidebarInset>
                    <TopBar>
                        <span>Members</span>
                    </TopBar>
                    <button data-testid="toggle-proxy">x</button>
                </SidebarInset>
            </SidebarProvider>
        );

        expect(
            screen.queryByRole('button', { name: 'Toggle Sidebar' })
        ).toBeNull();

        fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

        const trigger = screen.getByRole('button', { name: 'Toggle Sidebar' });
        expect(trigger.parentElement).toBe(bar());
        // It leads the bar — the reveal control comes before the crumbs, which
        // is what keeps the visual and tab orders agreeing (2.4.3).
        expect(bar()?.firstElementChild).toBe(trigger);
    });

    it('marks the icon tile decorative and lets actions trail', () => {
        render(
            <TopBar>
                <TopBarIcon data-testid="tile" />
                <span>Members</span>
                <TopBarActions>
                    <button>Invite</button>
                </TopBarActions>
            </TopBar>
        );

        expect(screen.getByTestId('tile').getAttribute('aria-hidden')).toBe(
            'true'
        );
        expect(screen.getByRole('button', { name: 'Invite' })).toBeTruthy();
    });
});
