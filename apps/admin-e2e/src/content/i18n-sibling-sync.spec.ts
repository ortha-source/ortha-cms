import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';
import { type ContentLibraryPage } from '../support/pages/ContentLibraryPage';
import {
    I18N_WORKSPACE,
    mockI18n,
    mockReferrerSync,
    mockSiblingSync
} from '../support/api/i18n';

/**
 * A save that reaches other locales of the record — a shared field changed, a
 * synced relation relinked — asks **once**. The editor sends it with
 * `askBeforeSiblingSync`; the server refuses with every locale it would change
 * and the published ones it would leave invalid, and the editor turns that one
 * answer into one dialog. It used to ask about the sync from the client, then,
 * after the server refused, ask again about the damage.
 */
test.describe('Saving a change other locales share [i18n:I-34] [i18n:I-35]', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [I18N_WORKSPACE]);
        await mockI18n(page);
    });

    async function changeSharedCategory(
        contentLibraryPage: ContentLibraryPage
    ) {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        // `category` is shared: one value for every locale of the record.
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();
    }

    test('a plain sync names the field and the locale, and Save resends without asking', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de']
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('This also changes another locale');
        await expect(dialog).toContainText('“Category”');
        // The language by name, not by its slug.
        await expect(dialog).toContainText('in German');

        await contentLibraryPage.dialogButton('Save').click();
        await expect.poll(() => patches.length).toBe(2);
        expect(patches[0].askBeforeSiblingSync).toBe(true);
        expect(patches[1].askBeforeSiblingSync).toBeUndefined();
        // Nothing was going to break, so nothing breaking was confirmed.
        expect(patches[1].allowInvalidSiblings).toBeUndefined();
        await expect(dialog).toBeHidden();
    });

    test('a sync that breaks a published translation is one dialog, not two', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de', 'fr'],
            invalidated: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toContainText(
            'This leaves a published locale incomplete'
        );
        await expect(dialog).toContainText('German and French');
        await expect(dialog).toContainText('“Category”');
        // The sibling's issue is not pinned on this form's own field.
        await expect(contentLibraryPage.fieldError('is required')).toHaveCount(
            0
        );

        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect.poll(() => patches.length).toBe(2);
        expect(patches[1].askBeforeSiblingSync).toBeUndefined();
        expect(patches[1].allowInvalidSiblings).toBe(true);
        await expect(dialog).toBeHidden();
    });

    test('a translation that broke after asking is asked about again', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de'],
            afterAsk: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        const dialog = contentLibraryPage.siblingSyncDialog;
        await contentLibraryPage.dialogButton('Save').click();
        // The resend is refused for an invalidation the person was never
        // shown, so it is not confirmed silently: the same dialog asks.
        await expect(dialog).toContainText(
            'This leaves a published locale incomplete'
        );
        expect(patches[1].allowInvalidSiblings).toBeUndefined();

        await contentLibraryPage.dialogButton('Save anyway').click();
        await expect.poll(() => patches.length).toBe(3);
        expect(patches[2].allowInvalidSiblings).toBe(true);
        await expect(dialog).toBeHidden();
    });

    test('a save that reaches no other locale saves without asking', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: []
        });
        await changeSharedCategory(contentLibraryPage);

        await expect.poll(() => patches.length).toBe(1);
        expect(patches[0].askBeforeSiblingSync).toBe(true);
        await expect(contentLibraryPage.siblingSyncDialog).toBeHidden();
    });

    /**
     * Record every time the save cover goes up or comes down. The project
     * ships no DOM lib, so the page's globals are typed inline (types only —
     * erased before the body is sent to the browser).
     */
    async function watchCover(page: Page) {
        type Page$ = {
            document: {
                querySelector(selector: string): unknown;
                body: unknown;
            };
            MutationObserver: new (callback: () => void) => {
                observe(
                    target: unknown,
                    options: { childList: boolean; subtree: boolean }
                ): void;
            };
            coverLog?: boolean[];
        };
        await page.evaluate(() => {
            const page$ = globalThis as unknown as Page$;
            const covered = () =>
                page$.document.querySelector('[data-testid="entry-busy"]') !==
                null;
            const log: boolean[] = [covered()];
            page$.coverLog = log;
            new page$.MutationObserver(() => {
                const now = covered();
                if (now !== log[log.length - 1]) log.push(now);
            }).observe(page$.document.body, { childList: true, subtree: true });
        });
        return () =>
            page.evaluate(
                () => (globalThis as unknown as Page$).coverLog ?? []
            );
    }

    test('the question opens with no cover before it, and only the confirmed save is covered', async ({
        page,
        contentLibraryPage
    }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de']
        });
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        const coverLog = await watchCover(page);
        await contentLibraryPage.pickFieldOption('category', 'news');
        await contentLibraryPage.saveDraft();

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toBeVisible();
        // The asking request came back as a question: no cover went up for
        // it, and none sits under the dialog.
        expect(await coverLog()).toEqual([false]);

        await contentLibraryPage.dialogButton('Save').click();
        await expect.poll(() => patches.length).toBe(2);
        await expect(dialog).toBeHidden();
        await expect(page.getByTestId('entry-busy')).toHaveCount(0);
        // One cover, for the save that happened.
        expect(await coverLog()).toEqual([false, true, false]);
    });

    test('an asked-first save that takes a while is still covered', async ({
        page,
        contentLibraryPage
    }) => {
        // Nothing else is reached, so the asking request is the save itself
        // — held well past the cover's delay.
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: []
        });
        await page.route(
            /\/api\/content\/localized_post\/lp-en-1$/,
            async (route) => {
                if (route.request().method() === 'PATCH')
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fallback();
            }
        );
        await changeSharedCategory(contentLibraryPage);

        await expect(page.getByTestId('entry-busy')).toBeVisible();
        await expect.poll(() => patches.length).toBe(1);
        await expect(page.getByTestId('entry-busy')).toHaveCount(0);
        await expect(contentLibraryPage.siblingSyncDialog).toBeHidden();
    });

    test('Cancel saves nothing more', async ({ page, contentLibraryPage }) => {
        const patches = await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de'],
            invalidated: [{ locale: 'de', field: 'category' }]
        });
        await changeSharedCategory(contentLibraryPage);

        await expect(contentLibraryPage.siblingSyncDialog).toBeVisible();
        await contentLibraryPage.dialogButton('Cancel').click();
        await expect(contentLibraryPage.siblingSyncDialog).toBeHidden();
        expect(patches).toHaveLength(1);
    });

    test('previews what the save does to each locale: values, links, and who is left out [i18n:I-37]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de'],
            changes: [
                {
                    type: 'localized_post',
                    typeLabel: 'Localized posts',
                    entryId: 'lp-de-1',
                    locale: 'de',
                    title: 'Winterstiefel',
                    sibling: true,
                    published: true,
                    optional: false,
                    fields: [
                        {
                            field: 'category',
                            label: 'Category',
                            before: 'guide',
                            after: 'news'
                        }
                    ],
                    links: [
                        {
                            field: 'related',
                            label: 'Related post',
                            added: [],
                            target: 'localized_post',
                            removed: [{ id: 'lp-de-2', title: 'Sommerhut' }],
                            unresolved: [{ id: 'lp-en-3', title: 'Rain coat' }]
                        }
                    ]
                }
            ]
        });
        await changeSharedCategory(contentLibraryPage);

        const preview = contentLibraryPage.siblingSyncDialog.getByRole(
            'region',
            { name: 'What else changes' }
        );
        await expect(preview).toContainText('German');
        await expect(preview).toContainText('German version');
        await expect(preview).toContainText(
            'Published · will show as Modified'
        );
        await expect(preview).toContainText(
            'CategoryNow: guide After saving: news'
        );
        await expect(preview).toContainText(
            'Related postWill be unlinked: Sommerhut'
        );
        await expect(preview).toContainText(
            '“Rain coat” has no German version yet'
        );
        // Each row and each linked record opens in its own editor.
        await expect(
            preview.getByRole('link', {
                name: 'Open German version in a new tab'
            })
        ).toHaveAttribute(
            'href',
            `/workspaces/${I18N_WORKSPACE.id}/content/localized_post/lp-de-1`
        );
        await expect(
            preview.getByRole('link', { name: 'Open Sommerhut in a new tab' })
        ).toHaveAttribute(
            'href',
            `/workspaces/${I18N_WORKSPACE.id}/content/localized_post/lp-de-2`
        );
        // Kept consistent by the sync itself: nothing here can be declined.
        await expect(preview.getByRole('checkbox')).toHaveCount(0);
    });

    test('a new translation asks before filling other records in, and leaves out the unticked one [i18n:I-38]', async ({
        page,
        contentLibraryPage
    }) => {
        const filled = (id: string, title: string) => ({
            type: 'localized_post',
            typeLabel: 'Localized posts',
            entryId: id,
            locale: 'fr',
            title,
            sibling: false,
            published: false,
            optional: true,
            fields: [],
            links: [
                {
                    field: 'related',
                    label: 'Related post',
                    target: 'localized_post',
                    added: [
                        {
                            id: 'lp-fr-new',
                            title: 'Bottes d’hiver',
                            self: true
                        }
                    ],
                    removed: [],
                    unresolved: []
                }
            ]
        });
        const posts = await mockReferrerSync(page, [
            filled('lp-fr-7', 'Guide des pistes'),
            filled('lp-fr-8', 'Nouveautés')
        ]);

        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        await contentLibraryPage.startTranslation('Français');
        await page.getByLabel(/Title/).fill('Bottes d’hiver');
        await contentLibraryPage.saveDraft();

        const dialog = contentLibraryPage.siblingSyncDialog;
        await expect(dialog).toContainText('This also changes 2 other records');
        await expect(dialog).toContainText('untick any record');
        const second = dialog.getByRole('checkbox', {
            name: 'Update Nouveautés · Localized posts · French'
        });
        await expect(second).toBeChecked();
        // The translation being created is this record: named so, with
        // nothing to open — it does not exist until the save.
        await expect(dialog).toContainText('Bottes d’hiverThis record');
        await expect(
            dialog.getByRole('link', { name: /Bottes d’hiver/ })
        ).toHaveCount(0);
        await second.click();
        await expect(second).not.toBeChecked();

        await contentLibraryPage.dialogButton('Save').click();
        await expect.poll(() => posts.length).toBe(2);
        expect(posts[0].askBeforeSiblingSync).toBe(true);
        expect(posts[1].askBeforeSiblingSync).toBeUndefined();
        expect(posts[1].skipReferrers).toEqual(['lp-fr-8']);
        await expect(dialog).toBeHidden();
    });

    test('a translation form says where its synced links will come from', async ({
        page,
        contentLibraryPage
    }) => {
        await contentLibraryPage.goto(I18N_WORKSPACE.id);
        await contentLibraryPage.typeLink('Localized posts').click();
        await contentLibraryPage.recordLink('Winter boots').click();
        await expect(contentLibraryPage.editorSave).toBeVisible();
        await contentLibraryPage.startTranslation('Français');
        await contentLibraryPage.openEditorTab('Relations');

        await expect(
            page.getByTestId('relations-inherited-note')
        ).toContainText(
            'this translation gets them from the record’s other languages'
        );
    });

    test('has no a11y violations while asking', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockSiblingSync(page, 'lp-en-1', {
            reached: ['de', 'fr'],
            invalidated: [
                { locale: 'de', field: 'category' },
                { locale: 'fr', field: 'category' }
            ]
        });
        await changeSharedCategory(contentLibraryPage);
        await expect(contentLibraryPage.siblingSyncDialog).toContainText(
            'published locales incomplete'
        );
        await expectNoA11yViolations(makeAxe());
    });
});
