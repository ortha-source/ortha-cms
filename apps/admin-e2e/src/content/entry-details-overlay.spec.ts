import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The entry editor's header and Properties since ADR-0022: the panel opens
 * **over** the form on demand and pins back into a column (`content:I-67`),
 * and what blocks publishing is said in the header's status cluster, which
 * leads to the field (`content:I-65`).
 *
 * The shared fixture pins Properties for every other suite; these unpin it,
 * which is the layout a reader starts in.
 */
test.describe('Entry editor — Properties on demand and the status cluster', () => {
    test.beforeEach(async ({ page, contentLibraryPage }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.unpinProperties();
    });

    test('opens over the form on demand, closes on Escape, and pins into a column', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await expect(contentLibraryPage.editorSave).toBeVisible();

        // Closed on arrival: the form has the page.
        await expect(contentLibraryPage.propertiesPanel).toHaveCount(0);
        await expect(contentLibraryPage.showPropertiesControl).toBeVisible();

        // ⌘. / Ctrl+. opens it, Escape closes it.
        await page.keyboard.press('ControlOrMeta+.');
        await expect(contentLibraryPage.propertiesPanel).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(contentLibraryPage.propertiesPanel).toHaveCount(0);

        // Pinned, it is a column that stays put across a reload.
        await contentLibraryPage.showPropertiesControl.click();
        await contentLibraryPage.pinPropertiesButton.click();
        await expect(contentLibraryPage.pinPropertiesButton).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await page.keyboard.press('Escape');
        await expect(contentLibraryPage.propertiesPanel).toBeVisible();
    });

    test('says what blocks publishing in the header and leads to the field', async ({
        contentLibraryPage
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await expect(contentLibraryPage.editorSave).toBeVisible();

        // An empty create form: the required Title blocks publishing.
        await expect(contentLibraryPage.statusCluster).toContainText('1 issue');
        await contentLibraryPage.statusCluster.click();
        await expect(contentLibraryPage.statusList).toContainText(
            'Blocks publishing'
        );
        await contentLibraryPage.statusList
            .getByRole('button', { name: 'Go to field' })
            .click();
        await expect(contentLibraryPage.fieldTextbox('Title')).toBeFocused();

        // Filled, the issue is gone and so is the cluster.
        await contentLibraryPage.fieldTextbox('Title').fill('Hello');
        await expect(contentLibraryPage.statusCluster).toHaveCount(0);
    });

    test('has no axe violations with the panel open over the form', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.gotoNewEntry(
            LIBRARY_WORKSPACE.id,
            'blog_post'
        );
        await expect(contentLibraryPage.editorSave).toBeVisible();
        await page.keyboard.press('ControlOrMeta+.');
        await expect(contentLibraryPage.propertiesPanel).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
