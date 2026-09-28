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
 * Collapsible **form sections** on the General tab — the schema's `groups`,
 * joined by `admin.group`.
 *
 * Folding is the risky half of the feature: a closed section hides its fields,
 * and a hidden field that blocks publishing is one the author publishes around.
 * So most of this suite is about what a *closed* section still says — the
 * blocker count in its header, and opening itself when a publish is refused.
 */
test.describe('Entry form sections', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntries(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
    });

    test('opens and folds each section as the schema says', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        // Ungrouped fields stay above every section.
        await expect(contentLibraryPage.fieldTextbox('Title')).toBeVisible();

        const details = contentLibraryPage.formSectionToggle('Details');
        const pricing = contentLibraryPage.formSectionToggle('Pricing');
        await expect(details).toHaveAttribute('aria-expanded', 'true');
        await expect(pricing).toHaveAttribute('aria-expanded', 'false');
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toHaveCount(
            0
        );

        await pricing.click();
        await expect(pricing).toHaveAttribute('aria-expanded', 'true');
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toBeVisible();
    });

    test('a folded section still names the blocker inside it', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        // `Price` is required and empty: the rail's publish gate lists it, and
        // the closed section's header counts it — the same set, one number.
        await expect(
            contentLibraryPage.formSectionToggle('Pricing')
        ).toHaveAccessibleName(/1 to fix before publishing/);
    });

    test('a refused publish opens the section holding the error', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        const pricing = contentLibraryPage.formSectionToggle('Pricing');
        await expect(pricing).toHaveAttribute('aria-expanded', 'false');

        await contentLibraryPage.editorSave.click();

        await expect(pricing).toHaveAttribute('aria-expanded', 'true');
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toBeVisible();
    });

    test('remembers a fold across a reload', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        const details = contentLibraryPage.formSectionToggle('Details');
        await details.click();
        await expect(details).toHaveAttribute('aria-expanded', 'false');

        await page.reload();

        await expect(
            contentLibraryPage.formSectionToggle('Details')
        ).toHaveAttribute('aria-expanded', 'false');
    });

    test('has no axe violations, folded and open', async ({
        makeAxe,
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await expect(contentLibraryPage.fieldTextbox('Title')).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await contentLibraryPage.formSectionToggle('Pricing').click();
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
