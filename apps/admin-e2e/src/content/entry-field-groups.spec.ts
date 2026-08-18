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
import { I18N_WORKSPACE, mockI18n } from '../support/api/i18n';

/**
 * The General tab's **field grouping** — the boundary between the run of
 * translated fields and the run of shared ones.
 *
 * Which run a field sits in decides whether editing it changes every locale, so
 * the split is the one thing on that tab a reader must not have to infer. It
 * used to be carried by whitespace alone; it is now drawn as a rule. Both
 * halves of the branch are pinned here: a type with both kinds of field gets the
 * grouped layout **with** the rule, and a type with only one kind keeps the
 * flat, header-free stack — where a lone rule would announce a division that
 * does not exist.
 */
test.describe('Entry editor field groups', () => {
    test.describe('a type with both translated and shared fields', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaces(page, [I18N_WORKSPACE]);
            await mockI18n(page);
        });

        test('draws a rule between the two runs, under their headings', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoNewEntry(
                I18N_WORKSPACE.id,
                'localized_post'
            );
            await expect(contentLibraryPage.editorSave).toBeVisible();

            // The headings the grouped layout has always had — the e2e for the
            // split itself lives in `i18n.spec.ts`; they are re-asserted here
            // because the rule is only meaningful as their boundary.
            await expect(
                contentLibraryPage.fieldGroupHeading('Translated fields')
            ).toBeVisible();
            await expect(
                contentLibraryPage.fieldGroupHeading('Shared fields')
            ).toBeVisible();

            // Exactly one rule: one boundary, drawn once.
            await expect(contentLibraryPage.fieldGroupDivider).toBeVisible();
            await expect(contentLibraryPage.fieldGroupDivider).toHaveCount(1);
        });

        test('the rule is decorative — it never lands in the a11y tree', async ({
            contentLibraryPage
        }) => {
            await contentLibraryPage.gotoNewEntry(
                I18N_WORKSPACE.id,
                'localized_post'
            );
            await expect(contentLibraryPage.fieldGroupDivider).toBeVisible();

            // A rule that names itself would sit between the two group headings
            // as content, read out on the way past and saying nothing. Radix's
            // `decorative` separator renders `role="none"`, which is what keeps
            // it out — the headings alone name the runs.
            await expect(contentLibraryPage.fieldGroupDivider).toHaveAttribute(
                'role',
                'none'
            );
            await expect(
                contentLibraryPage.fieldGroupDivider
            ).not.toHaveAttribute('aria-label', /.+/);
        });
    });

    test.describe('a type whose fields are all one kind', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockContentSchema(page);
            await mockContentSchemaDetail(page);
            await mockContentEntries(page);
            await mockContentEntryWrites(page);
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        });

        test('keeps the flat stack — no headings and no rule', async ({
            contentLibraryPage
        }) => {
            // `product` is a plain, non-i18n type: every field is shared, so
            // there is only one run. The grouping is inert outside i18n, and so
            // is its divider — a rule here would draw a boundary between a group
            // and nothing.
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'product'
            );
            await expect(contentLibraryPage.fieldTextbox('Name')).toBeVisible();

            await expect(
                contentLibraryPage.fieldGroupHeading('Translated fields')
            ).toHaveCount(0);
            await expect(
                contentLibraryPage.fieldGroupHeading('Shared fields')
            ).toHaveCount(0);
            await expect(contentLibraryPage.fieldGroupDivider).toHaveCount(0);
        });
    });
});
