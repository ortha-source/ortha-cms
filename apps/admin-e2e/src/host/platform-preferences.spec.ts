import { type Locator, type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * The two platform preferences nothing in this suite had ever emulated —
 * WCAG `1.4.3 (Contrast)`, `1.4.11 (Non-text Contrast)`, `2.4.7 (Focus
 * Visible)` and Section 508 `§503.2 (User Preferences)`.
 *
 * Every `a11y.spec.ts` in the project scans in the browser default, which is
 * light, so the dark palette had never been scanned at all. The one real
 * contrast failure this suite has ever caught (`muted-foreground`) was in the
 * light half; there was no reason to believe the other was clean, only no
 * measurement either way.
 *
 * Forced colors is the sharper of the two. In `forced-colors: active` the UA
 * discards `box-shadow` outright, and every focus indicator in the design
 * system is a Tailwind `ring-*` — which *is* a box-shadow. A Windows High
 * Contrast user therefore had no visible focus indicator anywhere in the admin.
 * axe cannot see this: it never emulates the media feature, so a clean scan
 * says nothing about it. These assertions read computed style instead.
 *
 * **Harness note.** `test.use({ forcedColors: 'active' })` is silently
 * ineffective here — the media query still reports `false` inside the page,
 * while `test.use({ colorScheme })` works normally. `page.emulateMedia()` does
 * take, so that is what forced colors uses below, the same way
 * `auth/reduced-motion.spec.ts` reaches for it. A spec that sets forced colors
 * the declarative way will pass while testing nothing.
 */

/** The resolved focus-indicator properties of one element. */
async function indicatorOf(locator: Locator): Promise<{
    outlineStyle: string;
    outlineWidth: string;
    boxShadow: string;
}> {
    return locator.evaluate((node) => {
        const style = (
            globalThis as unknown as {
                getComputedStyle: (el: unknown) => {
                    outlineStyle: string;
                    outlineWidth: string;
                    boxShadow: string;
                };
            }
        ).getComputedStyle(node);
        return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow
        };
    });
}

/** Whether one element currently holds focus. */
function isFocused(locator: Locator): Promise<boolean> {
    return locator.evaluate(
        (node) =>
            node ===
            (
                node as unknown as {
                    ownerDocument: { activeElement: unknown };
                }
            ).ownerDocument.activeElement
    );
}

/** Tabs until `target` holds focus, or gives up after `limit` presses. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<boolean> {
    for (let i = 0; i < limit; i++) {
        await page.keyboard.press('Tab');
        if (await isFocused(target)) {
            return true;
        }
    }
    return false;
}

test.describe('forced colors', () => {
    test('a button keeps a visible focus indicator', async ({
        page,
        membersPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();
        expect(
            await page.evaluate(() =>
                (
                    globalThis as unknown as {
                        matchMedia: (q: string) => { matches: boolean };
                    }
                ).matchMedia('(forced-colors: active)').matches
            )
        ).toBe(true);

        await membersPage.inviteButton.focus();
        const indicator = await indicatorOf(membersPage.inviteButton);

        // The premise, asserted so the outline check below cannot pass for the
        // wrong reason: the ring this button declares really is gone.
        expect(indicator.boxShadow).toBe('none');

        // Which leaves the outline as the only indicator. `Button` also carries
        // `focus-visible:outline-none`, a class+pseudo that outranks a bare
        // `:focus-visible` — the reason the forced-colors rule is `!important`.
        expect(indicator.outlineStyle).not.toBe('none');
        expect(parseFloat(indicator.outlineWidth)).toBeGreaterThanOrEqual(1);
    });

    test('the app scrollport keeps a visible focus indicator', async ({
        page,
        hostPage,
        workspacesPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await workspacesPage.goto();
        await expect(workspacesPage.heading).toBeVisible();

        // The scrollport is a deliberate tab stop with nothing else to see it
        // by — the worst place to lose an indicator, and the reason the inset
        // offset exists (an outset one is drawn outside `<main>`'s clip).
        expect(await tabTo(page, hostPage.insetScroll)).toBe(true);
        const indicator = await indicatorOf(hostPage.insetScroll);

        expect(indicator.outlineStyle).not.toBe('none');
        expect(parseFloat(indicator.outlineWidth)).toBeGreaterThanOrEqual(1);
    });

    test('nothing opts out of the user palette', async ({
        page,
        membersPage
    }) => {
        await page.emulateMedia({ forcedColors: 'active' });
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // `forced-color-adjust: none` is how a component overrides the palette
        // the user chose. Nothing in the product may — that is the failure the
        // preference exists to prevent, and it is worth an assertion because
        // the property is a tempting one-line "fix" for a flattened design.
        const optedOut = await page.evaluate(() => {
            const scope = globalThis as unknown as {
                document: {
                    querySelectorAll: (s: string) => ArrayLike<unknown>;
                };
                getComputedStyle: (el: unknown) => {
                    forcedColorAdjust?: string;
                };
            };
            return Array.from(scope.document.querySelectorAll('*')).filter(
                (node) => scope.getComputedStyle(node).forcedColorAdjust === 'none'
            ).length;
        });

        expect(optedOut).toBe(0);
        await expect(membersPage.inviteButton).toBeEnabled();
    });
});

/**
 * Contrast of the **focus ring** against the surface behind it, painted rather
 * than inferred: the ring is composited onto a canvas and the pixels are read
 * back, so the answer accounts for alpha, for `oklch()`, and for whatever the
 * token happens to resolve to today.
 *
 * axe's `color-contrast` rule does not evaluate focus indicators at all, so
 * this was invisible to every scan in the suite. `Button`'s ring used to be
 * `ring-ring/40`, which measured **1.70:1** in light and **1.79:1** in dark —
 * against the 3:1 that `1.4.11` requires — and the button has no other focus
 * affordance, no border change and no fill change, so that faint ring was the
 * whole indicator.
 */
async function ringContrast(
    page: Page
): Promise<{ vsPage: number; vsControl: number; ring: string }> {
    return page.evaluate(() => {
        const scope = globalThis as unknown as {
            document: {
                createElement: (t: string) => never;
                activeElement: never;
                body: never;
            };
            getComputedStyle: (el: unknown) => Record<string, string>;
        };
        const canvas = scope.document.createElement('canvas') as unknown as {
            width: number;
            height: number;
            getContext: (t: string, o: unknown) => never;
        };
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', {
            willReadFrequently: true
        }) as unknown as {
            clearRect: (a: number, b: number, c: number, d: number) => void;
            fillRect: (a: number, b: number, c: number, d: number) => void;
            getImageData: (
                a: number,
                b: number,
                c: number,
                d: number
            ) => { data: ArrayLike<number> };
            fillStyle: string;
        };

        /** `css` painted over `over`, read back as sRGB bytes. */
        const paint = (css: string, over?: string): number[] => {
            ctx.clearRect(0, 0, 1, 1);
            if (over) {
                ctx.fillStyle = over;
                ctx.fillRect(0, 0, 1, 1);
            }
            ctx.fillStyle = css;
            ctx.fillRect(0, 0, 1, 1);
            return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };

        const luminance = (rgb: number[]) => {
            const channel = (value: number) => {
                const c = value / 255;
                return c <= 0.03928
                    ? c / 12.92
                    : Math.pow((c + 0.055) / 1.055, 2.4);
            };
            return (
                0.2126 * channel(rgb[0]) +
                0.7152 * channel(rgb[1]) +
                0.0722 * channel(rgb[2])
            );
        };
        const contrast = (a: number[], b: number[]) => {
            const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
            return (hi + 0.05) / (lo + 0.05);
        };

        /** Splits a `box-shadow` value into layers, ignoring commas in `()`. */
        const layersOf = (value: string): string[] => {
            const out: string[] = [];
            let depth = 0;
            let current = '';
            for (const character of value) {
                if (character === '(') depth++;
                if (character === ')') depth--;
                if (character === ',' && depth === 0) {
                    out.push(current.trim());
                    current = '';
                } else {
                    current += character;
                }
            }
            if (current.trim()) out.push(current.trim());
            return out;
        };

        // The *focused* control, not the first button on the page — the ring
        // only exists in the computed style while `:focus-visible` matches.
        const control = scope.document.activeElement as unknown as never;
        const controlStyle = scope.getComputedStyle(control);
        const pageBackground = scope.getComputedStyle(scope.document.body)[
            'backgroundColor'
        ];

        // The ring as *painted*: the widest-spread visible layer of the
        // focused button's own `box-shadow`, alpha and all. Reading the
        // `--color-ring` token instead would silently ignore the `/40` that
        // was the entire defect.
        let ring = '';
        let widest = 0;
        for (const layer of layersOf(controlStyle['boxShadow'] ?? '')) {
            const geometry = layer.match(
                /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s*$/
            );
            if (!geometry) continue;
            const spread = parseFloat(geometry[4]);
            const color = layer.slice(0, layer.length - geometry[0].length).trim();
            if (!color) continue;
            const painted = paint(color, 'rgb(255,255,255)');
            const overBlack = paint(color, 'rgb(0,0,0)');
            const transparent =
                painted[0] === 255 && painted[1] === 255 && painted[2] === 255 &&
                overBlack[0] === 0 && overBlack[1] === 0 && overBlack[2] === 0;
            if (transparent) continue;
            if (spread >= widest) {
                widest = spread;
                ring = color;
            }
        }

        return {
            ring,
            vsPage: contrast(paint(ring, pageBackground), paint(pageBackground)),
            vsControl: contrast(
                paint(ring, controlStyle['backgroundColor']),
                paint(controlStyle['backgroundColor'], pageBackground)
            )
        };
    });
}

test.describe('focus indicator contrast', () => {
    for (const scheme of ['light', 'dark'] as const) {
        test(`the button focus ring clears 3:1 against the page in ${scheme}`, async ({
            page,
            loginPage
        }) => {
            await page.emulateMedia({ colorScheme: scheme });
            await loginPage.goto();
            await expect(loginPage.submit).toBeVisible();

            await loginPage.submit.focus();
            const { vsPage, vsControl, ring } = await ringContrast(page);

            // Nothing to measure means the ring was not found, not that it
            // passed — the failure mode this helper must not have.
            expect(ring).not.toBe('');

            // The page side is the one the whole ring is drawn onto, and it is
            // also what WCAG 2.2's change-of-state reading measures: the pixels
            // the indicator replaced.
            expect(vsPage).toBeGreaterThanOrEqual(3);
            // Recorded rather than asserted at 3: in dark this side measures
            // ~2.89:1 against a near-white button fill, and pushing it higher
            // is a token decision in `apps/admin/src/styles.css` rather than a
            // component one. It must not regress to the ~1.5:1 it was.
            expect(vsControl).toBeGreaterThanOrEqual(2.5);
        });
    }
});

test.describe('dark theme', () => {
    test.use({ colorScheme: 'dark' });

    test('the members table has no contrast failures in the dark palette', async ({
        page,
        membersPage,
        makeAxe
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // The theme preference defaults to `system`, so emulating the OS
        // scheme is what repaints the app — assert it took, or this would
        // silently be a second light-mode scan.
        await expect(page.locator('html')).toHaveClass(/dark/);

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });

    test('the workspaces dashboard has no contrast failures in the dark palette', async ({
        page,
        workspacesPage,
        makeAxe
    }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await workspacesPage.goto();
        await expect(workspacesPage.heading).toBeVisible();
        await expect(page.locator('html')).toHaveClass(/dark/);

        const results = await makeAxe().analyze();
        expect(results.violations).toEqual([]);
    });
});
