import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sidebar, SidebarInset, SidebarProvider } from './sidebar';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { TopBar, TopBarActions, TopBarIcon, TopBarTabs } from './top-bar';

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
    it('hoists itself into the inset strip, above the scrollport [design-system:I-27]', () => {
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

    /**
     * The second clause of `design-system:I-27`: while the strip's host is
     * `null` the bar is **not drawn at all**, so it never flashes in the page's
     * flow before moving.
     *
     * `null` is the one-commit window between `SidebarInset` rendering and its
     * `ref` callback publishing the strip. By the time `render()` returns, the
     * second commit has happened and the final DOM is identical either way — so
     * the observable is not the DOM, it is what happened *to* it, which a
     * `MutationObserver` records and `takeRecords()` drains synchronously.
     *
     * Specifically: a **removal**. Rendering the bar in place and then portaling
     * it is a change of fiber type, so React tears the in-flow `<div>` down and
     * mounts a fresh one inside the strip — and a `[data-slot="top-bar"]` node
     * leaving the document is something that simply never happens on the
     * intended path. Insertions are the wrong half to read: the first commit
     * appends the whole tree as one node, and by the time the records are
     * inspected that node contains the portaled bar in both worlds.
     */
    it('is not drawn at all while the strip’s host is null [design-system:I-27]', () => {
        const observer = new MutationObserver(() => undefined);
        observer.observe(document.body, { childList: true, subtree: true });

        /** Where each detached top-bar was taken from, in order. */
        let tornDownFrom: (string | null)[] = [];

        try {
            render(
                <SidebarProvider>
                    <SidebarInset>
                        <TopBar>
                            <span>Members</span>
                        </TopBar>
                    </SidebarInset>
                </SidebarProvider>
            );

            tornDownFrom = observer
                .takeRecords()
                .filter((record) =>
                    Array.from(record.removedNodes).some(
                        (node) =>
                            node instanceof HTMLElement &&
                            (node.matches('[data-slot="top-bar"]') ||
                                !!node.querySelector('[data-slot="top-bar"]'))
                    )
                )
                .map((record) =>
                    record.target instanceof HTMLElement
                        ? record.target.getAttribute('data-slot')
                        : null
                );
        } finally {
            observer.disconnect();
        }

        // Nothing was ever thrown away, because nothing was ever drawn in the
        // wrong place. Return `bar` instead of `null` from the `host === null`
        // branch and this becomes `['sidebar-inset-scroll']`: the bar painted
        // in the page's flow for a commit and was then torn out of it.
        expect(tornDownFrom).toEqual([]);
        // And it did end up in the strip — the control, without which the
        // assertion above would hold for a `TopBar` that renders nothing ever.
        expect(bar()?.parentElement).toBe(strip());
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

/**
 * A page's tabs, hoisted into the strip's second row. Two things are worth
 * pinning, both invisible in a page test: that the tabs land in the header
 * band rather than the scrollport, and that a `Tabs` root left down in the
 * page still owns them — the portal moves DOM, not React context, so the
 * triggers keep working from up there.
 */
describe('TopBarTabs', () => {
    it('hoists a page’s tabs under the bar, still owned by the page’s Tabs root [design-system:I-44]', () => {
        render(
            <SidebarProvider>
                <SidebarInset>
                    <TopBar>
                        <span>Members</span>
                    </TopBar>
                    <Tabs defaultValue="general">
                        <TopBarTabs>
                            <TabsList>
                                <TabsTrigger value="general">
                                    General
                                </TabsTrigger>
                                <TabsTrigger value="role">Role</TabsTrigger>
                            </TabsList>
                        </TopBarTabs>
                    </Tabs>
                </SidebarInset>
            </SidebarProvider>
        );

        const row = document.querySelector('[data-slot="top-bar-tabs"]');
        expect(row?.parentElement?.getAttribute('data-slot')).toBe(
            'sidebar-inset-tabs'
        );
        expect(
            document
                .querySelector('[data-slot="sidebar-inset-scroll"]')
                ?.contains(row as Node)
        ).toBe(false);

        // Radix selects on mousedown; the trigger answers from the bar.
        const role = screen.getByRole('tab', { name: 'Role' });
        fireEvent.mouseDown(role, { button: 0 });
        expect(role.getAttribute('aria-selected')).toBe('true');
    });

    it('renders in place on a page with no inset', () => {
        render(
            <Tabs defaultValue="general">
                <TopBarTabs>
                    <TabsList>
                        <TabsTrigger value="general">General</TabsTrigger>
                    </TabsList>
                </TopBarTabs>
            </Tabs>
        );

        expect(screen.getByRole('tab', { name: 'General' })).toBeTruthy();
    });
});
