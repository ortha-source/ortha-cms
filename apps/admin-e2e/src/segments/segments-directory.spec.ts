import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    manyUsageItems,
    mockSegmentsApi,
    type SegmentSeed
} from '../support/api/segments';
import { expectNoA11yViolations } from '../support/a11y';

test.beforeEach(async ({ page }) => {
    await mockSignedIn(page);
    await mockWorkspaces(page);
});

/**
 * `count` audiences, zero-padded so `Audience 02` cannot also match
 * `Audience 20` — and fresh per call, because the mock deletes from it.
 */
function pagedSeed(count: number): SegmentSeed[] {
    return Array.from({ length: count }, (_unused, index) => {
        const n = String(index + 1).padStart(2, '0');
        return {
            id: `seg-${n}`,
            key: `audience-${n}`,
            label: `Audience ${n}`,
            tags: [`audience-${n}`],
            workspaceIds: [],
            usageCount: 0
        };
    });
}

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
        // The key sits under the name, the tags as chips beside it.
        await expect(segmentsPage.row('Acme Corp')).toContainText(
            'acme-legacy'
        );
        // "Offered in" is stated rather than left blank, because empty means
        // *every* workspace — the opposite of what a blank cell reads as.
        await expect(segmentsPage.offeredIn('Acme Corp').first()).toHaveText(
            'Every workspace'
        );
    });

    test('explains what an audience is, above the table and below it', async ({
        page,
        segmentsPage
    }) => {
        // "Segments" alone told people nothing: the page says the model once
        // in its lede and once more where the table ends.
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await expect(
            page.getByText(/An entry says which audiences may read it/)
        ).toBeVisible();
        await expect(segmentsPage.modelNote).toBeVisible();
    });

    test('links the usage count to where the audience is used', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();

        await expect(segmentsPage.row('Globex')).toContainText('Not used yet');
        await segmentsPage.usageLink('Acme Corp').click();

        await expect(page).toHaveURL(/\/segments\/seg-acme$/);
        await expect(segmentsPage.usagePanel).toBeVisible();
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

        // Who will see what: the entries naming it, split by the side they
        // name it on, and what changes for its readers.
        const dialog = segmentsPage.deleteDialog;
        await expect(dialog).toContainText(
            '3 entries name this audience. After deleting:'
        );
        await expect(dialog).toContainText(
            'Enterprise pricing and Acme onboarding guide — no longer shown to Acme Corp readers only'
        );
        await expect(dialog).toContainText(
            'Competitor comparison — Acme Corp readers can see it again'
        );
        await segmentsPage.confirmDelete.click();

        await expect.poll(() => api.deleted).toEqual(['seg-acme']);
    });

    test('deleting the last audience on the last page steps back one page', async ({
        page,
        segmentsPage
    }) => {
        // 21 at ten a page: page three holds exactly one.
        await mockSegmentsApi(page, { segments: pagedSeed(21) });
        await segmentsPage.goto();
        await segmentsPage.setPageSize(10);
        await segmentsPage.nextPage.click();
        await segmentsPage.nextPage.click();
        await expect(segmentsPage.pageReadout).toHaveText('Page 3 of 3');

        await segmentsPage.deleteAudience('Audience 21');

        // Once — not twice. The page is settled from the refetched total, and
        // a decrement on top of that would land on page one.
        await expect(segmentsPage.pageReadout).toHaveText('Page 2 of 2');
        await expect(segmentsPage.row('Audience 20')).toBeVisible();
    });

    test('pulls the page back when the list shrinks under it', async ({
        page,
        segmentsPage
    }) => {
        // 22 at ten a page: page three holds two, so deleting one of them
        // through this tab leaves a page — until somebody else deletes the
        // other. Only a clamp on the fresh total catches that; arithmetic on
        // the rows this tab happened to be showing cannot.
        const api = await mockSegmentsApi(page, { segments: pagedSeed(22) });
        await segmentsPage.goto();
        await segmentsPage.setPageSize(10);
        await segmentsPage.nextPage.click();
        await segmentsPage.nextPage.click();
        await expect(segmentsPage.pageReadout).toHaveText('Page 3 of 3');
        await expect(segmentsPage.row('Audience 22')).toBeVisible();

        api.remove('seg-21');
        await segmentsPage.deleteAudience('Audience 22');

        await expect(segmentsPage.pageReadout).toHaveText('Page 2 of 2');
        await expect(segmentsPage.row('Audience 20')).toBeVisible();
    });

    test('sketches the table while it loads, rather than spinning', async ({
        page,
        segmentsPage
    }) => {
        // A spinner says only that something is happening, in the middle of an
        // otherwise empty page, and then moves every control into place when the
        // rows land. A skeleton says what is coming and leaves the layout where
        // it will be.
        await mockSegmentsApi(page, { listDelayMs: 1500 });
        await segmentsPage.goto();

        await expect(page.getByText('Loading audiences…')).toBeVisible();
        await expect(segmentsPage.row('Acme Corp')).toBeVisible();
        // …and it goes when the rows arrive, rather than sitting under them.
        await expect(page.getByText('Loading audiences…')).toHaveCount(0);
    });

    test('has no axe violations', async ({ page, segmentsPage, makeAxe }) => {
        await mockSegmentsApi(page);
        await segmentsPage.goto();
        await expect(segmentsPage.row('Acme Corp')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });

    test('has no axe violations while it loads', async ({
        page,
        segmentsPage,
        makeAxe
    }) => {
        // The state a slow connection sits in longest, and the one nothing else
        // scans: sixty placeholder bars under one `role="status"`, and no
        // heading order broken by the header the skeleton stands in for.
        await mockSegmentsApi(page, { listDelayMs: 4000 });
        await segmentsPage.goto();
        await expect(page.getByText('Loading audiences…')).toBeVisible();

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
        // Tags are chips: typed and committed one at a time.
        await segmentsPage.addTag('northwind');
        await segmentsPage.addTag('northwind-legacy');
        await expect(segmentsPage.tagChip('northwind-legacy')).toBeVisible();
        await expect(page.getByText(/^2 of 20 ·/)).toBeVisible();
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

        // Every workspace is a choice of its own, and the one an audience
        // starts with — not "leave every box empty".
        await expect(
            segmentsPage.offeredInChoice('Every workspace')
        ).toBeChecked();

        await segmentsPage.nameField.fill('Scoped');
        await segmentsPage.offeredInChoice('Some workspaces').click();
        await segmentsPage.workspaceBox('Marketing site').click();
        await segmentsPage.submit.click();

        await expect
            .poll(() => api.created[0]?.['workspaceIds'])
            .toEqual(['ws_marketing']);
    });

    test('refuses "Some workspaces" with none picked, rather than saving "every"', async ({
        page,
        segmentsPage
    }) => {
        // An empty list is how the server spells *every* workspace — the
        // opposite of the choice on screen.
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        await segmentsPage.nameField.fill('Scoped');
        await segmentsPage.offeredInChoice('Some workspaces').click();
        await segmentsPage.submit.click();

        await expect(
            segmentsPage.fieldError(/Pick at least one workspace/)
        ).toBeVisible();
        expect(api.created).toEqual([]);
    });

    test('tries a reader against the tags as typed', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        await segmentsPage.nameField.fill('Acme Corp');
        await segmentsPage.addTag('acme');
        await segmentsPage.addTag('acme-legacy');

        await segmentsPage.tester.fill('acme-legacy');
        await expect(segmentsPage.testerVerdict).toHaveText('In Acme Corp');

        await segmentsPage.tester.fill('globex');
        await expect(segmentsPage.testerVerdict).toHaveText('Not in Acme Corp');
        await expect(
            page.getByText(
                'Readers with acme or acme-legacy see entries restricted to Acme Corp.'
            )
        ).toBeVisible();
    });

    test('marks the required fields, and says what the mark means', async ({
        page,
        segmentsPage
    }) => {
        // The asterisk is `aria-hidden` — the control carries `aria-required`,
        // which is what is announced — so a sighted reader who does not know the
        // convention needs the legend, and it belongs in the page rather than in
        // a tooltip nobody can reach by keyboard.
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        await expect(
            page.getByText(/Fields marked \* are required/)
        ).toBeVisible();
        await expect(segmentsPage.nameField).toHaveAttribute(
            'aria-required',
            'true'
        );
        await expect(segmentsPage.keyField).toHaveAttribute(
            'aria-required',
            'true'
        );
        // Reader tags are not: an audience with none answers to its key.
        await expect(segmentsPage.tagsField).not.toHaveAttribute(
            'aria-required',
            'true'
        );
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
        await expect(segmentsPage.heading).toHaveCount(0);
        await expect(
            page.getByRole('heading', { name: 'Acme Corp', level: 1 })
        ).toBeVisible();
        await expect(segmentsPage.tagChip('acme')).toBeVisible();
        await expect(segmentsPage.tagChip('acme-legacy')).toBeVisible();
        // Read-only with the reason written next to it, rather than a greyed
        // field nobody can interrogate.
        await expect(segmentsPage.keyField).toHaveAttribute('readonly', '');
        await expect(
            segmentsPage.fieldError('Permanent — entries refer to it.')
        ).toBeVisible();
    });

    test('shows where it is used beside the form', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');

        await expect(segmentsPage.usagePanel).toHaveAccessibleName(
            'Used by 3 entries'
        );
        await expect(segmentsPage.usageRow('Enterprise pricing')).toContainText(
            'Can see'
        );
        await expect(
            segmentsPage.usageRow('Competitor comparison')
        ).toContainText('Cannot see');
        // Each entry opens in its workspace's editor…
        await expect(
            segmentsPage.usagePanel.getByRole('link', {
                name: 'Enterprise pricing'
            })
        ).toHaveAttribute(
            'href',
            '/workspaces/ws_marketing/content/blog_post/entry-pricing'
        );
        // …and the lot opens in records, filtered to the audience.
        const records = segmentsPage.usagePanel.getByRole('link', {
            name: 'Open in records'
        });
        await expect(records).toHaveAttribute(
            'href',
            /^\/workspaces\/ws_marketing\/content\/blog_post\?filter=/
        );
        // Workspace-scoped: every workspace was asked under its own header.
        expect(
            api.usageReads.every(([, workspace]) => workspace !== null)
        ).toBe(true);
        expect(api.usageReads.map(([, workspace]) => workspace)).toContain(
            'ws_marketing'
        );
    });

    test('lists eight entries, then shows all of them inside the panel', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page, {
            usage: { 'seg-acme': { ws_marketing: manyUsageItems(60) } }
        });
        await segmentsPage.gotoEdit('seg-acme');

        await expect(segmentsPage.usagePanel.getByRole('listitem')).toHaveCount(
            8
        );
        await expect(segmentsPage.usageToggle).toHaveText('Show all 60');
        await expect(segmentsPage.usageToggle).toHaveAttribute(
            'aria-expanded',
            'false'
        );

        // Keyboard: the toggle keeps focus whichever way it folds the list.
        await segmentsPage.usageToggle.focus();
        await page.keyboard.press('Enter');
        await expect(segmentsPage.usagePanel.getByRole('listitem')).toHaveCount(
            60
        );
        await expect(segmentsPage.usageToggle).toHaveText('Show fewer');
        await expect(segmentsPage.usageToggle).toBeFocused();

        await page.keyboard.press('Enter');
        await expect(segmentsPage.usagePanel.getByRole('listitem')).toHaveCount(
            8
        );
        await expect(segmentsPage.usageToggle).toBeFocused();
    });

    test('offers a retry when where-it-is-used cannot be read', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page, { usageStatus: 500 });
        await segmentsPage.gotoEdit('seg-acme');

        await expect(
            page.getByText('Couldn’t load the entries that use it.')
        ).toBeVisible({ timeout: 15_000 });
        await expect(
            segmentsPage.usagePanel.getByRole('button', { name: 'Try again' })
        ).toBeVisible();
    });

    test('deletes from its own page, naming who will see what', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');

        await segmentsPage.deleteButton.click();
        await expect(segmentsPage.deleteDialog).toContainText(
            'Competitor comparison — Acme Corp readers can see it again'
        );
        await segmentsPage.confirmDelete.click();

        await expect.poll(() => api.deleted).toEqual(['seg-acme']);
        await expect(page).toHaveURL(/\/segments$/);
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
        await expect(segmentsPage.usageRow('Enterprise pricing')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });

    test('has no axe violations while creating, with a reader tried', async ({
        page,
        segmentsPage,
        makeAxe
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();
        await segmentsPage.nameField.fill('Acme Corp');
        await segmentsPage.addTag('acme');
        await segmentsPage.offeredInChoice('Some workspaces').click();
        await segmentsPage.tester.fill('acme');
        await expect(segmentsPage.testerVerdict).toHaveText('In Acme Corp');

        await expectNoA11yViolations(makeAxe());
    });

    test('has no axe violations with the delete confirmation open', async ({
        page,
        segmentsPage,
        makeAxe
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');
        await segmentsPage.deleteButton.click();
        await expect(segmentsPage.deleteDialog).toContainText(
            'After deleting:'
        );

        await expectNoA11yViolations(makeAxe());
    });
});

test.describe('The audience editor, by keyboard', () => {
    test('adds and removes tags without a mouse', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        // The name field takes focus on arrival; Tab walks to the tags.
        await expect(segmentsPage.nameField).toBeFocused();
        await page.keyboard.type('Northwind');
        await page.keyboard.press('Tab'); // the key
        await page.keyboard.press('Tab'); // the tags
        await expect(segmentsPage.tagsField).toBeFocused();

        await page.keyboard.type('northwind');
        await page.keyboard.press('Enter');
        await page.keyboard.type('legacy,');
        await expect(segmentsPage.tagChip('northwind')).toBeVisible();
        await expect(segmentsPage.tagChip('legacy')).toBeVisible();

        // Backspace on an empty input takes the last chip back for editing.
        await page.keyboard.press('Backspace');
        await expect(segmentsPage.tagChip('legacy')).toHaveCount(0);
        await expect(segmentsPage.tagsField).toHaveValue('legacy');

        // A chip's × is a real button: reachable, and focus returns to the
        // input once it is gone.
        await segmentsPage.tagChip('northwind').focus();
        await page.keyboard.press('Enter');
        await expect(segmentsPage.tagChip('northwind')).toHaveCount(0);
        await expect(segmentsPage.tagsField).toBeFocused();
    });

    test('picks where it is offered with the arrow keys', async ({
        page,
        segmentsPage
    }) => {
        await mockSegmentsApi(page);
        await segmentsPage.gotoNew();

        await segmentsPage.offeredInChoice('Every workspace').focus();
        // Held rather than pressed: Radix checks a radio when focus arrives
        // *while* an arrow key is down, and moves focus a tick after the
        // keydown — an instant press-and-release lets go before it lands.
        await page.keyboard.down('ArrowRight');
        await expect(
            segmentsPage.offeredInChoice('Some workspaces')
        ).toBeFocused();
        await page.keyboard.up('ArrowRight');
        await expect(
            segmentsPage.offeredInChoice('Some workspaces')
        ).toBeChecked();
        await expect(segmentsPage.workspaceBox('Marketing site')).toBeVisible();
    });

    test('closes the delete confirmation with Escape, deleting nothing', async ({
        page,
        segmentsPage
    }) => {
        const api = await mockSegmentsApi(page);
        await segmentsPage.gotoEdit('seg-acme');

        await segmentsPage.deleteButton.focus();
        await page.keyboard.press('Enter');
        await expect(segmentsPage.deleteDialog).toBeVisible();
        await page.keyboard.press('Escape');

        await expect(segmentsPage.deleteDialog).toHaveCount(0);
        await expect(segmentsPage.deleteButton).toBeFocused();
        expect(api.deleted).toEqual([]);
    });
});
