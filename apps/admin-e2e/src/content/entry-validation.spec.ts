import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    HIDDEN_FIELD_DETAIL_SEED,
    HIDDEN_FIELD_SCHEMA_SEED,
    HIDDEN_FIELD_WORKSPACE,
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockPublishRejection
} from '../support/api/content';

/**
 * The entry editor's **refusal** paths — what the reader is told, and where they
 * are put, when a save or a publish cannot go through. Each case pins a state
 * that used to end in silence: a gate that disagreed with its own toast, a hint
 * that was on screen but never announced, or a refusal that left focus on the
 * button that had just stopped working.
 */
test.describe('Entry editor validation', () => {
    test.describe('a required field the editor renders nowhere', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockContentSchema(page, { types: HIDDEN_FIELD_SCHEMA_SEED });
            await mockContentSchemaDetail(page, {
                details: HIDDEN_FIELD_DETAIL_SEED
            });
            await mockContentEntries(page, {
                details: HIDDEN_FIELD_DETAIL_SEED
            });
            await mockContentEntryWrites(page, {
                details: HIDDEN_FIELD_DETAIL_SEED
            });
            await mockWorkspaces(page, [HIDDEN_FIELD_WORKSPACE]);
        });

        test('is left out of the publish gate and out of client validation alike', async ({
            page
        }) => {
            // The gate is built from the *visible* fields, so it read "ready"
            // while validation still counted the hidden one — two surfaces
            // contradicting each other over a control that exists nowhere.
            await page.goto(
                `/workspaces/${HIDDEN_FIELD_WORKSPACE.id}/content/gadget/new`
            );

            await expect(
                page.getByRole('heading', { name: 'New Gadgets' })
            ).toBeVisible();
            await expect(page.locator('#entry-field-title')).toBeVisible();
            await expect(page.locator('#entry-field-internalCode')).toHaveCount(
                0
            );

            await page.locator('#entry-field-title').fill('A gadget');
            // Every check the reader can act on now passes, so the primary
            // action reaches the server rather than dead-ending on the client.
            await expect(page.getByText('Needs attention:')).toHaveCount(0);
        });

        test('surfaces the server 422 as a toast when it names an unrendered field', async ({
            page,
            contentLibraryPage
        }) => {
            await mockPublishRejection(page, { field: 'internalCode' });
            await page.goto(
                `/workspaces/${HIDDEN_FIELD_WORKSPACE.id}/content/gadget/new`
            );

            await page.locator('#entry-field-title').fill('A gadget');
            await contentLibraryPage.editorSave.first().click();

            // An issue on a field with no control has nowhere inline to land, so
            // without this the busy cover simply lifted and nothing appeared.
            await expect(
                page.getByText(/The server refused “internalCode”/)
            ).toBeVisible();
        });

        test('a field keeps announcing its hint once it is showing an error', async ({
            page,
            contentLibraryPage
        }) => {
            // The error used to *replace* the description, so a reader who
            // tripped a rule lost the very instruction that would have kept
            // them out of it — the two can now both be announced.
            await page.goto(
                `/workspaces/${HIDDEN_FIELD_WORKSPACE.id}/content/gadget/new`
            );
            const title = page.locator('#entry-field-title');
            await expect(title).toHaveAttribute(
                'aria-describedby',
                'entry-field-title-description'
            );

            await contentLibraryPage.editorSave.first().click();

            await expect(title).toHaveAttribute('aria-invalid', 'true');
            await expect(title).toHaveAttribute(
                'aria-describedby',
                'entry-field-title-description entry-field-title-error'
            );
        });
    });

    test.describe('refused submits and field hints', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockContentSchema(page);
            await mockContentSchemaDetail(page);
            await mockContentEntries(page);
            await mockContentEntryWrites(page);
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        });

        test('a refused publish moves focus to the first invalid control', async ({
            page,
            contentLibraryPage
        }) => {
            // The toast says "start with X"; without this the reader had to find
            // X by hand — Shift+Tab out of the top bar, past the breadcrumb, into
            // a panel that may have just been swapped underneath them.
            await page.goto(
                `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post/new`
            );
            await contentLibraryPage.editorSave.first().click();

            await expect(page.locator('#entry-field-title')).toBeFocused();
        });

        test('the publish gate states each row pass or fail in words', async ({
            page,
            contentLibraryPage
        }) => {
            // Pass/fail was carried by an `aria-hidden` icon and its colour
            // alone, so a passing row read as one more outstanding item.
            await page.goto(
                `/workspaces/${LIBRARY_WORKSPACE.id}/content/blog_post/new`
            );

            await expect(page.getByText('Needs attention:')).toBeVisible();
            await page.locator('#entry-field-title').fill('A post');
            await expect(page.getByText('Passes:')).toBeVisible();
        });
    });
});
