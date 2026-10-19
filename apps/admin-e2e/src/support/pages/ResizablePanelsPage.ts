import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the admin's **resizable panels** — the design system's
 * `ResizeHandle` on the edge of the app sidebar and of the shell's right panel.
 * Like `HostPage` it has no route of its own: the chrome is on every page, so a
 * spec navigates with whichever feature page object it likes and reaches the
 * panels through this one.
 */
export class ResizablePanelsPage extends BasePage {
    /** The splitter on the app sidebar's right edge. */
    readonly sidebarHandle: Locator;
    /**
     * The desktop sidebar panel. Located by `data-slot` because its landmark
     * is the inner element — the width lives on the fixed container around it.
     */
    readonly sidebarPanel: Locator;
    /** The right panel's column (`#app-right-panel`). */
    readonly rightPanel: Locator;

    constructor(page: Page) {
        super(page);
        this.sidebarHandle = page.getByRole('separator', {
            name: 'Resize sidebar'
        });
        this.sidebarPanel = page.locator('[data-slot="sidebar-container"]');
        this.rightPanel = page.locator('#app-right-panel');
    }

    /** The splitter on the right panel's left edge, named after its title. */
    rightPanelHandle(title: string): Locator {
        return this.page.getByRole('separator', { name: `Resize ${title}` });
    }

    /** Whether the desktop sidebar is collapsed, as the panel itself reports it. */
    async sidebarState(): Promise<string | null> {
        return this.page
            .locator('[data-slot="sidebar"][data-state]')
            .first()
            .getAttribute('data-state');
    }

    /** A panel's rendered width, in CSS pixels. */
    async widthOf(panel: Locator): Promise<number> {
        const box = await panel.boundingBox();
        if (!box) throw new Error('the panel has no box to measure');
        return Math.round(box.width);
    }

    /**
     * The cursor the page shows at viewport point `(x, y)` once a drag is over
     * — what the element there resolves to, which a stuck resize flag on the
     * root would override.
     */
    async cursorAt(x: number, y: number): Promise<string> {
        return this.page.evaluate(
            ([px, py]) => {
                // No DOM lib in this project — typed structurally, as in
                // `HostPage`.
                const g = globalThis as unknown as {
                    document: {
                        elementFromPoint(x: number, y: number): unknown;
                    };
                    getComputedStyle(el: unknown): { cursor: string };
                };
                return g.getComputedStyle(g.document.elementFromPoint(px, py))
                    .cursor;
            },
            [x, y] as const
        );
    }

    /** Whether `<html>` still carries the design system's drag flag. */
    async dragFlagged(): Promise<boolean> {
        return (
            (await this.page
                .locator('html')
                .getAttribute('data-panel-resizing')) !== null
        );
    }

    /**
     * Presses on `handle`, moves `dx` pixels, then releases at `releaseAt` —
     * far from the handle, the way a fast drag ends — and moves on afterwards
     * with the button up.
     */
    async dragAndReleaseElsewhere(
        handle: Locator,
        dx: number,
        releaseAt: { x: number; y: number }
    ): Promise<void> {
        const box = await handle.boundingBox();
        if (!box) throw new Error('the handle has no box to grab');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + dx, y, { steps: 6 });
        await this.page.mouse.move(releaseAt.x, releaseAt.y, { steps: 6 });
        await this.page.mouse.up();
        await this.page.mouse.move(releaseAt.x + 120, releaseAt.y, {
            steps: 6
        });
    }

    /** Presses on `handle`, moves `dx` pixels, presses Escape, then releases. */
    async escapeMidDrag(handle: Locator, dx: number): Promise<void> {
        const box = await handle.boundingBox();
        if (!box) throw new Error('the handle has no box to grab');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + dx, y, { steps: 6 });
        await this.page.keyboard.press('Escape');
        await this.page.mouse.up();
    }

    /**
     * Drags `handle` horizontally by `dx` pixels with a real pointer — down on
     * the handle's centre, a stepped move so the handle sees intermediate
     * positions as it would from a hand, then up.
     */
    async drag(handle: Locator, dx: number): Promise<void> {
        const box = await handle.boundingBox();
        if (!box) throw new Error('the handle has no box to grab');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + dx, y, { steps: 8 });
        await this.page.mouse.up();
    }
}
