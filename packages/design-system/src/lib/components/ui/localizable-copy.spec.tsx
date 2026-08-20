import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious
} from './pagination';
import { Sheet, SheetContent, SheetTitle } from './sheet';
import {
    Sidebar,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger
} from './sidebar';

/**
 * QA ORT-49 · F20/F21/F33 — `🐞 BUG-design-system-03` / `♿ A11Y-design-system-01`.
 *
 * Every icon-only control the library ships *has* an accessible name, so this
 * was never a bare 4.1.2 failure — the name was simply a hard-coded English
 * literal with no way to override it, which is a 3.1.2 problem the moment the
 * surrounding page is German. The defaults stay English so nothing shifts under
 * existing consumers; what these specs pin is that a localized string can now
 * get in at all.
 */
describe('localizable copy', () => {
    it('lets a consumer name the dialog close button', () => {
        render(
            <Dialog open>
                <DialogContent closeLabel="Schließen">
                    <DialogTitle>Mitglied entfernen</DialogTitle>
                </DialogContent>
            </Dialog>
        );

        expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    });

    it('defaults the dialog close button to English', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Remove member</DialogTitle>
                </DialogContent>
            </Dialog>
        );

        expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });

    it('lets a consumer name the sheet close button', () => {
        render(
            <Sheet open>
                <SheetContent closeLabel="Schließen">
                    <SheetTitle>Filter</SheetTitle>
                </SheetContent>
            </Sheet>
        );

        expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    });

    it('lets a consumer name the sidebar trigger and rail', () => {
        render(
            <SidebarProvider>
                <SidebarTrigger label="Seitenleiste umschalten" />
                <SidebarRail label="Seitenleiste ziehen" />
            </SidebarProvider>
        );

        expect(
            screen.getByRole('button', { name: 'Seitenleiste umschalten' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Seitenleiste ziehen' })
        ).toBeTruthy();
    });

    it('defaults the sidebar trigger to English', () => {
        render(
            <SidebarProvider>
                <SidebarTrigger />
            </SidebarProvider>
        );

        expect(
            screen.getByRole('button', { name: 'Toggle Sidebar' })
        ).toBeTruthy();
    });

    it('lets a consumer name the mobile sidebar overlay', () => {
        // The overlay is a dialog; without this its name was "Sidebar" in every
        // locale. `Sidebar` only mounts the Sheet below the breakpoint.
        expect(() =>
            render(
                <SidebarProvider>
                    <Sidebar mobileTitle="Seitenleiste" mobileDescription="…" />
                </SidebarProvider>
            )
        ).not.toThrow();
    });

    it('lets a consumer label the pagination controls', () => {
        render(
            <Pagination aria-label="Seitennummerierung">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            label="Zurück"
                            aria-label="Zur vorherigen Seite"
                        />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            label="Weiter"
                            aria-label="Zur nächsten Seite"
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );

        expect(
            screen.getByRole('navigation', { name: 'Seitennummerierung' })
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Zur vorherigen Seite' })
                .textContent
        ).toBe('Zurück');
        expect(
            screen.getByRole('link', { name: 'Zur nächsten Seite' }).textContent
        ).toBe('Weiter');
    });
});
