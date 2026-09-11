import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import {
    UNPROTECTED,
    mockEntryReview,
    mockNewEntryProtection
} from '../support/api/protection';

const WS = LIBRARY_WORKSPACE.id;
const TYPE = 'blog_post';
/** The first row of the fabricated page — the record whose editor is opened. */
const ENTRY = 'blog_post-01';

/**
 * Publication protection **inside the entry editor** — the three surfaces an
 * editor actually meets it through, in a real browser.
 *
 * The server side is covered by `server-e2e`; what only a browser can answer is
 * whether the requirement is *legible*: whether a person who has not read the
 * ADR can tell why Publish will not go, and whether the count rolling back
 * after a save explains itself instead of just changing.
 */
test.describe('Publication protection in the entry editor', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        await mockEntryRelations(page);
    });

    /**
     * The state every installation is in until somebody writes a rule, and the
     * one this plugin spends almost all of its life in. Nothing may appear.
     */
    test('says nothing at all on an unprotected type', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, UNPROTECTED);
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText(/needs review/i)).toHaveCount(0);
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toHaveCount(0);
        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toBeVisible();
        await expect(publish).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('shows the requirement in the chip and the rail', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, { required: 2, given: 0 });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText('Needs review · 0 of 2')).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toBeVisible();
        await expect(page.getByText('0 of 2', { exact: true })).toBeVisible();
    });

    /**
     * ⭐ The line the whole feature turns on. The strike-through is decoration;
     * the sentence beside it is the fact, and it must be real text on the page.
     */
    test('explains a stale approval in words, not only in decoration', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 1,
            stale: 1,
            approvals: [
                { userId: 'u-anna', decision: 'approved', revisionNumber: 7 },
                {
                    userId: 'u-dmitry',
                    decision: 'approved',
                    revisionNumber: 4,
                    revisionId: 'rev-4',
                    isStale: true
                }
            ]
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await expect(page.getByText(/approved version 7/)).toBeVisible();
        await expect(
            page.getByText(
                /approved version 4 .* the entry has changed since, so this no longer counts/
            )
        ).toBeVisible();
    });

    test('holds the publish button and says how far short it is', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, { required: 2, given: 0, blocked: true });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toHaveAttribute('aria-disabled', 'true');
        // The reason reaches a screen reader as the button's *description*.
        await expect(
            page.getByText('2 approvals required on this version, 0 given.')
        ).toBeAttached();
    });

    /**
     * The button an administrator meets is an ordinary Publish — the bypass is
     * announced by the dialog the click opens, which names the rule and demands
     * a reason, not by a second kind of button.
     */
    test('keeps an ordinary Publish for an administrator and asks for a reason on click [protection:I-20]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toBeVisible();
        await expect(publish).not.toHaveAttribute('aria-disabled', 'true');
        await expect(
            page.getByRole('button', { name: /publish anyway/i })
        ).toHaveCount(0);

        await publish.click();
        await expect(page.getByRole('dialog')).toBeVisible();
    });

    /**
     * ⭐ The bug this pins: Publish used to save first unconditionally, and the
     * save wrote a new version — so the approval just given was on a version
     * nobody was publishing, and the publish was refused for it.
     */
    test('publishes an approved, unchanged entry without saving it first [protection:I-19]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 1,
            given: 1,
            blocked: false
        });
        const saves: string[] = [];
        page.on('request', (request) => {
            if (
                request.method() === 'PATCH' &&
                request.url().includes(`/api/content/${TYPE}/${ENTRY}`)
            ) {
                saves.push(request.url());
            }
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const published = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                request.url().endsWith(`/api/content/${TYPE}/${ENTRY}/publish`)
        );
        await page.getByRole('button', { name: /^publish$/i }).click();
        await published;

        expect(saves).toHaveLength(0);
    });

    /**
     * The other half of the same fact: with unsaved edits, Publish saves first,
     * that save is a new version, and the approval on the stored one will not
     * count. The button has to say so before the click, not after the save.
     */
    test('holds Publish once there are unsaved edits the approval does not cover [protection:I-18]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 1,
            given: 1,
            blocked: false,
            afterSave: { required: 1, given: 0, blocked: true }
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).not.toHaveAttribute('aria-disabled', 'true');

        await contentLibraryPage.fieldTextbox('Title').fill('A late edit');

        await expect(publish).toHaveAttribute('aria-disabled', 'true');
        await expect(
            page.getByText(
                'Saving your changes starts a new version: 1 approval required, 0 would count.'
            )
        ).toBeAttached();
    });

    test('sends the bypass reason with the publish itself [protection:I-20]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await page.getByRole('button', { name: /^publish$/i }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(/reason/i).fill('Legal signed off by phone');

        const published = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                request.url().endsWith(`/api/content/${TYPE}/${ENTRY}/publish`)
        );
        await dialog.getByRole('button', { name: /publish anyway/i }).click();

        expect((await published).postDataJSON()).toEqual({
            bypassReason: 'Legal signed off by phone'
        });
        await expect(dialog).toHaveCount(0);
    });

    /**
     * ⭐ The half of the bypass fix nothing else sees: the edits on screen go
     * out **before** the publish that carries the reason. The dialog used to
     * post the publish itself, shipping the stored record and dropping the
     * edit.
     */
    test('saves the edits on screen, then publishes with the reason [protection:I-20]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 1,
            given: 1,
            blocked: false,
            afterSave: { given: 0, blocked: true, bypassable: true }
        });
        const writes: { method: string; path: string; body: unknown }[] = [];
        page.on('request', (request) => {
            const path = new URL(request.url()).pathname;
            if (!path.startsWith(`/api/content/${TYPE}/${ENTRY}`)) return;
            if (request.method() !== 'PATCH' && request.method() !== 'POST')
                return;
            writes.push({
                method: request.method(),
                path,
                body: request.postDataJSON()
            });
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await contentLibraryPage.fieldTextbox('Title').fill('Corrected title');

        await page.getByRole('button', { name: /^publish$/i }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(/reason/i).fill('Correction must go out');
        await dialog.getByRole('button', { name: /publish anyway/i }).click();

        await expect.poll(() => writes.length).toBe(2);
        expect(writes[0]).toMatchObject({
            method: 'PATCH',
            body: {
                values: expect.objectContaining({ title: 'Corrected title' })
            }
        });
        expect(writes[1]).toEqual({
            method: 'POST',
            path: `/api/content/${TYPE}/${ENTRY}/publish`,
            body: { bypassReason: 'Correction must go out' }
        });
    });

    /** The menu is the second door; it must be shut with the first. */
    test('holds the menu’s Save & publish along with the button [protection:I-21]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, { required: 2, given: 0, blocked: true });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await expect(
            page.getByRole('button', { name: /^publish$/i })
        ).toHaveAttribute('aria-disabled', 'true');

        await contentLibraryPage.openEditorMenu();
        await expect(
            page.getByRole('menuitem', { name: 'Save & publish' })
        ).toHaveAttribute('aria-disabled', 'true');
    });

    test('opens the reason dialog from the menu when a bypass is offered [protection:I-21]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await contentLibraryPage.openEditorMenu();
        await contentLibraryPage.chooseEditorAction('Save & publish');

        await expect(page.getByRole('dialog')).toContainText(
            /entry\.publish_bypassed/
        );
    });

    /**
     * A refusal that is not a field problem carries its only explanation in the
     * response body — and used to leave the screen saying nothing at all.
     */
    test('says why when the server refuses the publish', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, UNPROTECTED);
        await page.route(`**/api/content/${TYPE}/${ENTRY}/publish`, (route) =>
            route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    statusCode: 409,
                    code: 'protection.insufficient_approvals',
                    message:
                        'Publishing "blog_post" needs 1 approval(s) on the current version; it has 0.'
                })
            })
        );
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await page.getByRole('button', { name: /^publish$/i }).click();

        await expect(
            contentLibraryPage.toast(
                'Not published: Publishing "blog_post" needs 1 approval(s) on the current version; it has 0.'
            )
        ).toBeVisible();
    });

    /**
     * ⭐ The refusal a person can hear. The confirm stays operable — a disabled
     * control announces nothing — so an empty reason must be answered, not
     * ignored.
     */
    test('refuses a bypass with no reason, out loud', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        await page.getByRole('button', { name: /^publish$/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/entry\.publish_bypassed/)).toBeVisible();

        const confirm = dialog.getByRole('button', {
            name: /publish anyway/i
        });
        await expect(confirm).toBeEnabled();
        await confirm.click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('alert')).toContainText(
            /reason is required/i
        );
    });

    test('returns focus to the trigger when the dialog closes', async ({
        page,
        contentLibraryPage
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 0,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const trigger = page.getByRole('button', { name: /^publish$/i });
        await trigger.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });

    /**
     * A create form has no entry to read a review of, so it asks what a new
     * entry of the type would meet — and an administrator is asked for the
     * reason **before** anything is written, then the record is created and
     * published in the one press.
     */
    test('asks an administrator for a reason on a create form, then creates and publishes [protection:I-20]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockNewEntryProtection(page, {
            required: 1,
            blocked: true,
            bypassable: true
        });
        await contentLibraryPage.gotoNewEntry(WS, TYPE);
        await contentLibraryPage.fieldTextbox('Title').fill('Launch notes');

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).not.toHaveAttribute('aria-disabled', 'true');
        await publish.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(/reason/i).fill('Launch cannot wait');

        const created = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                /\/api\/content\/blog_post(\?|$)/.test(request.url())
        );
        const published = page.waitForRequest(
            (request) =>
                request.method() === 'POST' &&
                request
                    .url()
                    .endsWith(`/api/content/${TYPE}/${TYPE}-new/publish`)
        );
        await dialog.getByRole('button', { name: /publish anyway/i }).click();

        await created;
        expect((await published).postDataJSON()).toEqual({
            bypassReason: 'Launch cannot wait'
        });
    });

    test('holds Publish on a create form for a member who may not bypass [protection:I-18]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockNewEntryProtection(page, { required: 1, bypassable: false });
        await contentLibraryPage.gotoNewEntry(WS, TYPE);

        const publish = page.getByRole('button', { name: /^publish$/i });
        await expect(publish).toHaveAttribute('aria-disabled', 'true');
        await expect(
            page.getByText(
                '1 approval required before a new entry of this type can be published.'
            )
        ).toBeAttached();
    });

    test('has no accessibility violations with a rule in force', async ({
        page,
        contentLibraryPage,
        makeAxe
    }) => {
        await mockEntryReview(page, {
            required: 2,
            given: 1,
            stale: 1,
            bypassable: true,
            approvals: [
                { userId: 'u-anna', decision: 'approved', revisionNumber: 7 },
                {
                    userId: 'u-dmitry',
                    decision: 'approved',
                    revisionNumber: 4,
                    isStale: true
                }
            ]
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await expect(
            page.getByRole('heading', { name: 'Review', exact: true })
        ).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
