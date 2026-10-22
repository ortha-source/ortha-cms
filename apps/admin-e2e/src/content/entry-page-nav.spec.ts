import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    SECTIONED_DETAIL_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * **On this page** — the entry form's sections as a short list
 * (`content:I-69`), which replaced the per-field bar outline (ADR-0022).
 *
 * The sectioned seed draws three: Basics (Title, Excerpt), Details, and
 * Pricing — which starts folded, holding a required Price. With room beside
 * the form it is a list; on a narrower work area the same thing is a
 * "Sections" menu in the title block.
 */
test.describe('Entry editor — On this page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntries(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
    });

    test.describe('with room beside the form', () => {
        test.use({ viewport: { width: 1720, height: 900 } });

        test('lists the sections, counts what blocks, and opens a folded one', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.unpinProperties();
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'blog_post'
            );

            await expect(contentLibraryPage.pageNav).toBeVisible();
            await expect(
                contentLibraryPage.pageNavItem('Basics')
            ).toBeVisible();
            await expect(
                contentLibraryPage.pageNavItem('Details')
            ).toBeVisible();
            // The folded section's required Price is counted on its row, so
            // the fold does not hide it.
            await expect(
                contentLibraryPage.pageNavItem('Pricing')
            ).toHaveAccessibleName(/1 issue/);
            await expect(
                contentLibraryPage.formSectionToggle('Pricing')
            ).toHaveAttribute('aria-expanded', 'false');

            await contentLibraryPage.pageNavItem('Pricing').click();

            await expect(
                contentLibraryPage.formSectionToggle('Pricing')
            ).toHaveAttribute('aria-expanded', 'true');
            await expect(
                contentLibraryPage.pageNavItem('Pricing')
            ).toHaveAttribute('aria-current', 'location');
            await expect(contentLibraryPage.sectionsMenu).toHaveCount(0);
        });

        test('has no axe violations', async ({
            contentLibraryPage,
            makeAxe
        }) => {
            await contentLibraryPage.unpinProperties();
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'blog_post'
            );
            await expect(contentLibraryPage.pageNav).toBeVisible();
            await expectNoA11yViolations(makeAxe());
        });
    });

    test('is a Sections menu on a narrower work area', async ({
        contentLibraryPage
    }) => {
        // The default viewport with Properties docked beside the form leaves
        // well under 1024px for it.
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        await expect(contentLibraryPage.sectionsMenu).toBeVisible();
        await expect(contentLibraryPage.pageNav).toHaveCount(0);

        await contentLibraryPage.sectionsMenu.click();
        await contentLibraryPage.sectionsMenuItem('Pricing').click();
        await expect(
            contentLibraryPage.formSectionToggle('Pricing')
        ).toHaveAttribute('aria-expanded', 'true');
    });

    test('draws no map for a form with fewer than three sections', async ({
        page,
        contentLibraryPage
    }) => {
        // `product` declares no sections at all.
        await page.setViewportSize({ width: 1720, height: 900 });
        await contentLibraryPage.gotoNewEntry(LIBRARY_WORKSPACE.id, 'product');
        await expect(contentLibraryPage.fieldTextbox('Name')).toBeVisible();

        await expect(contentLibraryPage.pageNav).toHaveCount(0);
        await expect(contentLibraryPage.sectionsMenu).toHaveCount(0);
    });
});
