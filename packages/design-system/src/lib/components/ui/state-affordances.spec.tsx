import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SegmentedControl, SegmentedControlItem } from './segmented-control';
import {
    Sidebar,
    SidebarContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from './sidebar';

/**
 * WCAG 1.4.1 — the two places in the library where "this one is selected" is
 * drawn as a fill.
 *
 * A fill alone fails twice over: for a user who cannot separate the two hues,
 * and for any user in forced-colors mode, where the UA flattens the palette and
 * the selected item becomes indistinguishable from its neighbours. Both
 * components therefore pair the fill with a font-weight bump keyed to the *same*
 * state, so the selection survives the colour being taken away.
 *
 * The weight is the half that reads as decoration. It is one utility in a long
 * class list, it changes nothing a test clicking through the control would
 * notice, and deleting it while tidying the string is the regression this
 * exists to catch — so each assertion pairs the fill with its twin rather than
 * checking either alone. jsdom applies no Tailwind, so the pairing is asserted
 * on the class list the way `SidebarInset`'s focus ring already is.
 */
describe('selected state carries more than colour', () => {
    it('thickens the chosen segment as well as filling it [design-system:I-33]', () => {
        render(
            <SegmentedControl value="all" aria-label="Match">
                <SegmentedControlItem value="all">All</SegmentedControlItem>
                <SegmentedControlItem value="any">Any</SegmentedControlItem>
            </SegmentedControl>
        );

        const selected = screen.getByRole('radio', { name: 'All' });
        expect(selected.getAttribute('data-state')).toBe('on');
        expect(selected.className).toContain('data-[state=on]:bg-primary');
        expect(selected.className).toContain('data-[state=on]:font-semibold');
        // Keyed to the same state, so the two cannot drift apart: the
        // unselected sibling carries the identical conditional classes and
        // renders neither.
        expect(
            screen
                .getByRole('radio', { name: 'Any' })
                .getAttribute('data-state')
        ).toBe('off');
    });

    it('thickens the active panel item as well as filling it [design-system:I-33]', () => {
        render(
            <SidebarProvider>
                <Sidebar>
                    <SidebarContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton isActive>
                                    Content
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton>Media</SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarContent>
                </Sidebar>
            </SidebarProvider>
        );

        const active = screen.getByRole('button', { name: 'Content' });
        expect(active.getAttribute('data-active')).toBe('true');
        expect(active.className).toContain(
            'data-[active=true]:bg-sidebar-accent'
        );
        expect(active.className).toContain('data-[active=true]:font-medium');
        expect(
            screen
                .getByRole('button', { name: 'Media' })
                .getAttribute('data-active')
        ).toBe('false');
    });
});
