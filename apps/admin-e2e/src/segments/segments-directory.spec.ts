import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockSegmentsApi } from '../support/api/segments';
import { expectNoA11yViolations } from '../support/a11y';

test.beforeEach(async ({ page }) => {
    await mockSignedIn(page);
    await mockWorkspaces(page);
});

/**
 * The audience directory and its editor pages.
 *
 * This surface had **no** browser coverage and could not have had any: the
 * signed-in admin every suite shares was seeded without `segments:read` /
 * `segments:manage`, so the page, the editor, the entry editor's Access tab and
 * the records filter fields all rendered for nobody. Adding those two keys to
 * `ALL_PERMISSIONS` is what made this file possible — the fifth time that gap
 * has hidden a whole feature.
 */
test.describe('The audience directory', () => {
    test('lists the audiences, with where each is offered', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await expect(segmentsPage.heading).toBeVisible();
        await expect(segmentsPage.row('Acme Corp')).toBeVisible();
        // "Offered in" is stated rather than left blank, because empty means
        // *every* workspace — the opposite of what a blank cell reads as.
        await expect(segmentsPage.offeredIn('Acme Corp').first()).toHaveText(
            'Every workspace'
        );
    });

    test('pages rather than dumping the whole vocabulary', async ({
        page,
        segmentsPage
    }) => {
        // Three seeded audiences, ten per page by default — so drive the pager
        // by shrinking the page from the footer control, which is the same
        // thing a reader does.
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await page.getByRole('combobox', { name: 'Rows per page' }).click();
        await page.getByRole('option', { name: '10', exact: true }).click();
        await expect(page.getByText('1–3 of 3')).toBeVisible();
    });

    test('narrows by a search term', async ({ page, segmentsPage }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await segmentsPage.search.fill('globex');
        await expect(segmentsPage.row('Globex')).toBeVisible();
        await expect(segmentsPage.row('Acme Corp')).toHaveCount(0);
    });

    test('says so when nothing matches, rather than looking empty', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await segmentsPage.search.fill('nothing-like-this');
        await expect(page.getByText(/No audience matches/)).toBeVisible();
    });

    test('offers a retry when the directory read fails', async ({
        page,
        segmentsPage
    }) => {
        // A failed read is not an empty one — an empty state here would tell an
        // administrator their audiences are gone.
        await mockSegmentsApi(page, { listStatus: 500 });
        await segmentsPage.goto();

        await expect(segmentsPage.errorAlert).toBeVisible({ timeout: 15_000 });
        await expect(
            page.getByRole('button', { name: 'Try again' })
        ).toBeVisible();
    });

    test('deletes an audience only after naming the consequence', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.goto();

        await segmentsPage.rowMenu('Acme Corp').click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();

        // The consequence is spelled out per case: this one is named by three
        // entries, so deleting it changes what readers see.
        await expect(
            page.getByRole('alertdialog').getByText(/removed from every entry/)
        ).toBeVisible();
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Delete' })
            .click();

        await expect.poll(() => api.deleted).toEqual(['seg-acme']);
    });

    test('has no axe violations', async ({ page, segmentsPage, makeAxe }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();
        await expect(segmentsPage.row('Acme Corp')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

test.describe('The audience editor', () => {
    test('creates an audience from its own page', async ({
        page,
        segmentsPage
    }) => {
        // A page rather than a dialog: an audience also decides which
        // workspaces may use it, and a modal that scrolls has outgrown being
        // one.
        const api = await mockSegmentsApi(page);
        await segmentsPage.goto();
        await segmentsPage.createLink.click();

        await expect(page).toHaveURL(/\/segments\/new$/);
        await segmentsPage.nameField.fill('Northwind');
        await segmentsPage.tagsField.fill('northwind\nnorthwind-legacy');
        await segmentsPage.submit.click();

        await expect
            .poll(() => api.created)
            .toEqual([
                {
                    // The key tracks the name until somebody takes it over.
                    key: 'northwind',
                    label: 'Northwind',
                    tags: ['northwind', 'northwind-legacy'],
                    workspaceIds: []
                }
            ]);
        // …and returns to the directory, which is where the audience is now.
        await expect(page).toHaveURL(/\/segments$/);
    });

    test('scopes an audience to chosen workspaces', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        // Nothing ticked means every workspace, and the control says so rather
        // than leaving it to be inferred.
        await expect(segmentsPage.offeredInBadge).toHaveText('Every workspace');

        await segmentsPage.nameField.fill('Scoped');
        await segmentsPage.workspaceBox('Marketing site').click();
        await segmentsPage.submit.click();

        await expect
            .poll(() => api.created[0]?.['workspaceIds'])
            .toHaveLength(1);
    });

    test('refuses an empty name, without calling the API', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        // The submit is never disabled on invalid input: pressing it is how
        // somebody with nothing focused finds out which field is wrong.
        await segmentsPage.submit.click();

        await expect(
            segmentsPage.fieldError('Give the audience a name.')
        ).toBeVisible();
        expect(api.created).toEqual([]);
    });

    test('refuses a malformed key on blur, not on the first keystroke', async ({
        page,
        segmentsPage
    }) => {
        // A key is malformed for the whole time somebody is typing it.
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        await segmentsPage.nameField.fill('Acme');
        await segmentsPage.keyField.fill('Acme Corp');
        await expect(
            segmentsPage.fieldError(/Use lowercase letters/)
        ).toHaveCount(0);

        await segmentsPage.keyField.blur();
        await expect(
            segmentsPage.fieldError(/Use lowercase letters/)
        ).toBeVisible();
    });

    test('lands a taken key on the key field, not in a toast', async ({
        page,
        segmentsPage
    }) => {
        // The directory is paginated, so a local "existing keys" check would be
        // one page of them — the server's 409 is the complete answer, and it
        // belongs on the field that is still on screen and still looks fine.
        await mockSegmentsApi(page, { createStatus: 409 });
        await segmentsPage.gotoNew();

        await segmentsPage.nameField.fill('Acme Corp');
        await segmentsPage.submit.click();

        await expect(
            segmentsPage.fieldError('An audience with this key already exists.')
        ).toBeVisible();
    });

    test('opens an existing audience with its values, and its key locked', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');

        await expect(segmentsPage.nameField).toHaveValue('Acme Corp');
        await expect(segmentsPage.tagsField).toHaveValue('acme\nacme-legacy');
        // Read-only with the reason written next to it, rather than a greyed
        // field nobody can interrogate.
        await expect(segmentsPage.keyField).toHaveAttribute('readonly', '');
        await expect(
            segmentsPage.fieldError(/The key is permanent/)
        ).toBeVisible();
    });

    test('sends only what changed on save', async ({ page, segmentsPage }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');
        await expect(segmentsPage.nameField).toHaveValue('Acme Corp');

        await segmentsPage.nameField.fill('Acme Corporation');
        await segmentsPage.submit.click();

        await expect
            .poll(() => api.updated)
            .toEqual([
                [
                    'seg-acme',
                    {
                        label: 'Acme Corporation',
                        tags: ['acme', 'acme-legacy'],
                        workspaceIds: []
                    }
                ]
            ]);
    });

    test('has no axe violations', async ({ page, segmentsPage, makeAxe }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');
        await expect(segmentsPage.nameField).toHaveValue('Acme Corp');

        await expectNoA11yViolations(makeAxe());
    });
});
