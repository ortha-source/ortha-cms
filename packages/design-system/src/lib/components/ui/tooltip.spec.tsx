import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from './sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from './tooltip';

/**
 * QA ORT-49 · F28, `♿ A11Y-design-system-08` — the tooltip, which had zero
 * coverage of any kind.
 *
 * The open question was `SidebarMenuButton`'s `hidden={state !== 'collapsed'}`:
 * if Radix's `hidden` merely hid the panel visually, every expanded sidebar row
 * would carry an `aria-describedby` duplicating its own label — a description
 * that says the same thing as the name is noise a screen-reader user cannot
 * skip. It does not: `hidden` keeps the content unmounted, and the trigger is
 * left undescribed.
 */
describe('Tooltip', () => {
    it('opens on focus, not only on hover, and describes its trigger', async () => {
        render(
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger>Settings</TooltipTrigger>
                    <TooltipContent>Workspace settings</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );

        const trigger = screen.getByRole('button', { name: 'Settings' });
        expect(trigger.getAttribute('aria-describedby')).toBeNull();

        // Focus, not hover — a hover-only tooltip is a 1.4.13 failure and this
        // is the half that had never been observed.
        fireEvent.focus(trigger);

        await waitFor(() =>
            expect(screen.getAllByText('Workspace settings').length).toBeGreaterThan(0)
        );
        await waitFor(() =>
            expect(trigger.getAttribute('aria-describedby')).not.toBeNull()
        );
    });

    it('dismisses on Escape with focus left where it was', async () => {
        render(
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger>Settings</TooltipTrigger>
                    <TooltipContent>Workspace settings</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );

        const trigger = screen.getByRole('button', { name: 'Settings' });
        trigger.focus();
        fireEvent.focus(trigger);
        await waitFor(() =>
            expect(trigger.getAttribute('aria-describedby')).not.toBeNull()
        );

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() =>
            expect(trigger.getAttribute('aria-describedby')).toBeNull()
        );
        expect(document.activeElement).toBe(trigger);
    });
});

describe('SidebarMenuButton tooltip', () => {
    function renderRow() {
        return render(
            <SidebarProvider>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Members">
                            Members
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarProvider>
        );
    }

    it('leaves an expanded row undescribed rather than echoing its own label', async () => {
        renderRow();
        const row = screen.getByRole('button', { name: 'Members' });

        fireEvent.focus(row);
        // Give Radix a chance to open before concluding it did not.
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(row.getAttribute('aria-describedby')).toBeNull();
        expect(screen.getAllByText('Members')).toHaveLength(1);
    });

    it('describes the row once the sidebar is collapsed to icons', async () => {
        renderRow();

        fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

        // Re-query: collapsing swaps the bare button for a `TooltipTrigger`,
        // so the node from before the toggle is gone.
        const row = screen.getByRole('button', { name: 'Members' });
        fireEvent.focus(row);

        await waitFor(() =>
            expect(row.getAttribute('aria-describedby')).not.toBeNull()
        );
    });
});
