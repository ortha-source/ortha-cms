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
 * The General tab's **outline** — bars at the editor's left edge that open
 * into a list of fields and jump to one.
 *
 * Run against the sectioned fixture on purpose: the jump that is easy to get
 * half right is the one into a **folded** section, which has to unfold before
 * there is a field to scroll to, let alone focus.
 */
test.describe('Entry field outline', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntries(page, { details: SECTIONED_DETAIL_SEED });
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
    });

    test('jumps into a folded section and puts the cursor in the field', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        const pricing = contentLibraryPage.formSectionToggle('Pricing');
        await expect(pricing).toHaveAttribute('aria-expanded', 'false');

        await contentLibraryPage.fieldOutline().hover();
        await contentLibraryPage.fieldOutlineItem('Price').click();

        await expect(pricing).toHaveAttribute('aria-expanded', 'true');
        await expect(contentLibraryPage.fieldSpinbutton('Price')).toBeFocused();
    });

    /**
     * The list is transparent until hovered or focused, not hidden — hidden
     * would take it out of the tab order, and a keyboard could never open it.
     */
    test('works from the keyboard', async ({ page, contentLibraryPage }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );

        const title = contentLibraryPage.fieldOutlineItem('Title');
        await title.focus();
        await expect(title).toBeVisible();
        await page.keyboard.press('Enter');

        await expect(contentLibraryPage.fieldTextbox('Title')).toBeFocused();
    });

    test('has no axe violations while open', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await contentLibraryPage.fieldOutline().hover();

        await expectNoA11yViolations(makeAxe());
    });
});
