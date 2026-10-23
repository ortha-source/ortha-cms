import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    RELATIONS_WORKSPACE,
    RELATIONS_SCHEMA_SEED,
    RELATIONS_DETAIL_SEED,
    RELATIONS_ENTRIES_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries
} from '../support/api/content';
import {
    NEEDS_REVIEW_VIEW,
    SHARED_VIEW,
    mockSavedViews,
    mockSavedViewsError,
    spyDeleteView,
    spySaveView,
    spySetDefaultView,
    spyUpdateView,
    type SavedViewSeed
} from '../support/api/savedViews';

/**
 * The **saved-view switcher** over a collection's records table.
 *
 * What these cases pin is the seam between a view and the URL: applying one
 * writes the ordinary list params and a `?view=` **pointer**, so a view, a
 * pasted link and the Back button are all the same mechanism. The rest is the
 * modified state — the one part of such a feature that is easy to ship subtly
 * wrong, because a badge that is always on and a badge that is never on look
 * equally plausible in a screenshot.
 */
test.describe('Saved views', () => {
    /** Seed the signed-in shell + the relations collection, with `views`. */
    async function seed(
        page: Parameters<typeof mockSignedIn>[0],
        views: SavedViewSeed[]
    ) {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockSavedViews(page, views);
    }

    test('offers to save the first view when none exist', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, []);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

        // The row has one shape whether or not anything is saved: All
        // records, and "+ View" where the first one is made.
        await expect(savedViewsPage.activeTab()).toContainText('All records');
        await expect(savedViewsPage.newView()).toBeVisible();
    });

    test('renders the switcher when views exist, grouped by visibility', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, [NEEDS_REVIEW_VIEW, SHARED_VIEW]);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

        await expect(savedViewsPage.activeTab()).toContainText('All records');
        await expect(savedViewsPage.tab('Needs review')).toBeVisible();
        await expect(savedViewsPage.tab('Editorial backlog')).toBeVisible();
    });

    test('applying a view writes its params and the view pointer to the URL', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, [NEEDS_REVIEW_VIEW]);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');
        await savedViewsPage.tab('Needs review').click();

        await expect(savedViewsPage.activeTab()).toContainText('Needs review');
        const url = new URL(page.url());
        expect(url.searchParams.get('view')).toBe(NEEDS_REVIEW_VIEW.id);
        expect(url.searchParams.get('sort')).toBe('-updatedAt');
        expect(url.searchParams.get('filter')).toBe(
            NEEDS_REVIEW_VIEW.payload.filter
        );
        // A view describes a slice, not a position in it.
        expect(url.searchParams.get('page')).toBeNull();
    });

    test('a link carrying ?view= opens with that view applied', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, [NEEDS_REVIEW_VIEW]);
        await savedViewsPage.goto(
            RELATIONS_WORKSPACE.id,
            'article',
            `?view=${NEEDS_REVIEW_VIEW.id}`
        );

        await expect(savedViewsPage.activeTab()).toContainText('Needs review');
    });

    test('clearing back to All records drops the filter and the pointer', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, [NEEDS_REVIEW_VIEW]);
        await savedViewsPage.goto(
            RELATIONS_WORKSPACE.id,
            'article',
            `?view=${NEEDS_REVIEW_VIEW.id}`
        );
        await savedViewsPage.tab('All records').click();

        await expect(savedViewsPage.activeTab()).toContainText('All records');
        const url = new URL(page.url());
        expect(url.searchParams.get('view')).toBeNull();
        expect(url.searchParams.get('filter')).toBeNull();
    });

    test.describe('the modified state', () => {
        test('stays clean on the state the view was saved with', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}`
            );

            await expect(savedViewsPage.activeTab()).not.toContainText(
                'Modified'
            );
            await expect(savedViewsPage.reset()).toHaveCount(0);
        });

        test('does not trip on a search — a search is not part of the slice', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}&q=anything`
            );

            await expect(savedViewsPage.activeTab()).not.toContainText(
                'Modified'
            );
        });

        test('does not trip on the page number', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}&page=2`
            );

            await expect(savedViewsPage.activeTab()).not.toContainText(
                'Modified'
            );
        });

        test('trips when the filter is dropped, and Reset puts it back', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}&sort=text`
            );

            await expect(savedViewsPage.activeTab()).toContainText('Modified');
            await savedViewsPage.reset().click();

            await expect(savedViewsPage.activeTab()).not.toContainText(
                'Modified'
            );
            expect(new URL(page.url()).searchParams.get('sort')).toBe(
                '-updatedAt'
            );
        });

        test('offers no Save on a shared view somebody else owns', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [SHARED_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${SHARED_VIEW.id}&sort=text`
            );

            await expect(savedViewsPage.activeTab()).toContainText('Modified');
            // Their view stays theirs — the remedy is a copy, not a rewrite.
            await expect(savedViewsPage.saveChanges()).toHaveCount(0);
            await expect(savedViewsPage.saveAsNew()).toBeVisible();
        });
    });

    test.describe('the save dialog', () => {
        test('captures the slice without the search box or the page', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, []);
            const spy = spySaveView(page);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                '?sort=-updatedAt&q=gdansk&page=3'
            );

            await savedViewsPage.saveAs();
            await expect(savedViewsPage.dialog()).toBeVisible();
            await expect(savedViewsPage.capturedSummary()).toBeVisible();

            await savedViewsPage.nameInput().fill('My slice');
            await savedViewsPage.submit().click();

            await expect(savedViewsPage.dialog()).toHaveCount(0);
            expect(spy.count).toBe(1);
            const payload = (spy.lastBody?.payload ?? {}) as Record<
                string,
                unknown
            >;
            expect(spy.lastBody?.name).toBe('My slice');
            expect(spy.lastBody?.scope).toBe('content:article');
            expect(payload.sort).toBe('-updatedAt');
            // The two exclusions the dialog promises in its own copy.
            expect(payload).not.toHaveProperty('search');
            expect(payload).not.toHaveProperty('page');
        });

        test('defaults to Personal, and Shared is disabled without views:share', async ({
            page,
            savedViewsPage
        }) => {
            await mockSignedIn(page, { permissions: ['content:read'] });
            await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
            await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
            await mockContentSchemaDetail(page, {
                details: RELATIONS_DETAIL_SEED
            });
            await mockContentEntries(page, {
                details: RELATIONS_DETAIL_SEED,
                entries: RELATIONS_ENTRIES_SEED
            });
            await mockSavedViews(page, []);

            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');
            await savedViewsPage.saveAs();

            await expect(savedViewsPage.visibility('Personal')).toBeChecked();
            await expect(savedViewsPage.visibility('Shared')).toBeDisabled();
            // Disabled, but it says why rather than being merely dead.
            await expect(
                savedViewsPage
                    .dialog()
                    .getByText('Sharing needs the “views:share” permission')
            ).toBeVisible();
        });

        test('will not submit an empty name', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, []);
            const spy = spySaveView(page);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.saveAs();
            await expect(savedViewsPage.submit()).toBeDisabled();
            expect(spy.count).toBe(0);
        });
    });

    test('renders the table without a switcher when views fail to load', async ({
        page,
        savedViewsPage
    }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [RELATIONS_WORKSPACE]);
        await mockContentSchema(page, { types: RELATIONS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, { details: RELATIONS_DETAIL_SEED });
        await mockContentEntries(page, {
            details: RELATIONS_DETAIL_SEED,
            entries: RELATIONS_ENTRIES_SEED
        });
        await mockSavedViewsError(page);

        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

        // The records table is the page's job; views are an accessory to it,
        // so their outage must not take the collection down with them.
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(savedViewsPage.newView()).toHaveCount(0);
    });

    test.describe('keyboard', () => {
        test('opens the selected view’s menu from its ▾ and gives focus back', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}`
            );

            await savedViewsPage.options('Needs review').focus();
            // Opening must land focus **inside** the menu, on its first item —
            // otherwise a keyboard user gets a visible menu and no way into it.
            await page.keyboard.press('Enter');
            await expect(savedViewsPage.menuItem('Rename')).toBeFocused();

            await page.keyboard.press('Escape');
            await expect(savedViewsPage.menuItem('Rename')).toHaveCount(0);
            await expect(savedViewsPage.options('Needs review')).toBeFocused();
        });

        test('Shift+F10 on any tab opens its menu without applying it', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.tab('Needs review').focus();
            await page.keyboard.press('Shift+F10');

            await expect(savedViewsPage.menuItem('Duplicate')).toBeVisible();
            await expect(savedViewsPage.activeTab()).toContainText(
                'All records'
            );
            expect(new URL(page.url()).searchParams.get('view')).toBeNull();
        });

        test('the dialog focuses the name field and submits on Enter', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, []);
            const spy = spySaveView(page);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.saveAs();
            await expect(savedViewsPage.nameInput()).toBeFocused();

            await page.keyboard.type('Typed in');
            await page.keyboard.press('Enter');

            await expect(savedViewsPage.dialog()).toHaveCount(0);
            expect(spy.count).toBe(1);
            expect(spy.lastBody?.name).toBe('Typed in');
        });
    });

    test('says how many columns a stale view lost, without calling it modified', async ({
        page,
        savedViewsPage
    }) => {
        // The view pins a column the type no longer has. Applying it shows the
        // survivors; the reader changed nothing, so the badge must stay off.
        await seed(page, [
            {
                ...NEEDS_REVIEW_VIEW,
                payload: {
                    ...NEEDS_REVIEW_VIEW.payload,
                    columns: ['text', 'long_gone_field']
                }
            }
        ]);
        await savedViewsPage.goto(
            RELATIONS_WORKSPACE.id,
            'article',
            `?view=${NEEDS_REVIEW_VIEW.id}`
        );

        await expect(
            page.getByText(/column in this view no longer exists/)
        ).toBeVisible();
        await expect(savedViewsPage.activeTab()).not.toContainText('Modified');
    });

    test('lands on the reader’s default view from a bare URL', async ({
        page,
        savedViewsPage
    }) => {
        await seed(page, [{ ...NEEDS_REVIEW_VIEW, isDefault: true }]);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

        await expect(savedViewsPage.activeTab()).toContainText('Needs review');
        const url = new URL(page.url());
        expect(url.searchParams.get('view')).toBe(NEEDS_REVIEW_VIEW.id);
        expect(url.searchParams.get('filter')).toBe(
            NEEDS_REVIEW_VIEW.payload.filter
        );
    });

    test('the sidebar back to the collection lands on the default again', async ({
        page,
        savedViewsPage,
        contentLibraryPage
    }) => {
        // The records route is **one element** for every collection, so the
        // sidebar link back to the list does not remount this view. Resolving
        // the default once per mount meant it only ever took effect on a full
        // page load: set one, click the collection in the sidebar, and the
        // plain list came back.
        await seed(page, [{ ...NEEDS_REVIEW_VIEW, isDefault: true }]);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');
        await expect(savedViewsPage.activeTab()).toContainText('Needs review');

        await contentLibraryPage.typeLink('Articles').click();

        await expect(savedViewsPage.activeTab()).toContainText('Needs review');
        expect(new URL(page.url()).searchParams.get('view')).toBe(
            NEEDS_REVIEW_VIEW.id
        );
    });

    test('All records stays picked over the reader’s own default', async ({
        page,
        savedViewsPage
    }) => {
        // The counterweight to the case above: clearing a view produces the
        // same bare URL a fresh arrival has, and re-applying the default there
        // would make "All records" un-pickable.
        await seed(page, [{ ...NEEDS_REVIEW_VIEW, isDefault: true }]);
        await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');
        await expect(savedViewsPage.activeTab()).toContainText('Needs review');

        await savedViewsPage.tab('All records').click();

        await expect(savedViewsPage.activeTab()).toContainText('All records');
        expect(new URL(page.url()).searchParams.get('view')).toBeNull();
    });

    test.describe('deleting a view', () => {
        test('asks first, and Cancel leaves the view alone', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spyDeleteView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}`
            );

            await savedViewsPage.open('Needs review');
            await savedViewsPage.deleteItem().click();

            // The menu item only asks — a view is somebody's saved work and
            // deleting it cannot be undone.
            await expect(savedViewsPage.confirmDeleteDialog()).toBeVisible();
            await expect(savedViewsPage.confirmDeleteDialog()).toContainText(
                'Needs review'
            );
            expect(spy.count).toBe(0);

            await savedViewsPage.cancelDelete().click();

            await expect(savedViewsPage.confirmDeleteDialog()).toHaveCount(0);
            expect(spy.count).toBe(0);
            await expect(savedViewsPage.activeTab()).toContainText(
                'Needs review'
            );
        });

        test('confirming deletes it and returns focus to the switcher', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spyDeleteView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}`
            );

            await savedViewsPage.open('Needs review');
            await savedViewsPage.deleteItem().click();
            await savedViewsPage.confirmDelete().click();

            await expect(savedViewsPage.confirmDeleteDialog()).toHaveCount(0);
            await expect(savedViewsPage.toast('View deleted.')).toBeVisible();
            expect(spy.count).toBe(1);
            expect(spy.lastId).toBe(NEEDS_REVIEW_VIEW.id);
            expect(new URL(page.url()).searchParams.get('view')).toBeNull();

            // The control that opened the dialog was a menu item on a tab that
            // is gone — so focus has to be put back by hand or it lands on
            // <body>. The selected tab always exists, so it is what takes it.
            await expect(savedViewsPage.activeTab()).toBeFocused();
            await expect(savedViewsPage.activeTab()).toContainText(
                'All records'
            );
        });

        test('keeps focus on the switcher when other views remain', async ({
            page,
            savedViewsPage
        }) => {
            // The common path, and the counterweight to the case above: with a
            // view left, focus still lands on the tab now selected.
            const mine = { ...SHARED_VIEW, isOwn: true };
            await seed(page, [NEEDS_REVIEW_VIEW, mine]);
            const spy = spyDeleteView(page, [NEEDS_REVIEW_VIEW, mine]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${mine.id}`
            );

            await savedViewsPage.open(mine.name);
            await savedViewsPage.deleteItem().click();
            await savedViewsPage.confirmDelete().click();

            expect(spy.count).toBe(1);
            await expect(savedViewsPage.activeTab()).toBeFocused();
            await expect(savedViewsPage.activeTab()).toContainText(
                'All records'
            );
        });

        test('says a shared view is being removed for everyone', async ({
            page,
            savedViewsPage
        }) => {
            // Someone else's shared view can't be deleted here at all (the item
            // is `isOwn`-gated), so the case worth pinning is your **own**
            // shared one — where the confirm is the only place the blast radius
            // is stated.
            const ownShared = { ...SHARED_VIEW, isOwn: true };
            await seed(page, [ownShared]);
            spyDeleteView(page, [ownShared]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${ownShared.id}`
            );

            await savedViewsPage.open(ownShared.name);
            await savedViewsPage.deleteItem().click();

            await expect(savedViewsPage.confirmDeleteDialog()).toContainText(
                'removes it for everyone'
            );
        });
    });

    test.describe('the default view', () => {
        test('setting one is confirmed by name, and clearing it says so', async ({
            page,
            savedViewsPage
        }) => {
            // Nothing on screen moves when a default changes — it decides the
            // *next* visit — so the toast is the only evidence the click landed.
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spySetDefaultView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(
                RELATIONS_WORKSPACE.id,
                'article',
                `?view=${NEEDS_REVIEW_VIEW.id}`
            );

            await savedViewsPage.open('Needs review');
            await savedViewsPage.defaultItem().click();

            await expect(
                savedViewsPage.toast(/“Needs review” is now your default view/)
            ).toBeVisible();
            expect(spy.set).toBe(1);
            expect(spy.lastId).toBe(NEEDS_REVIEW_VIEW.id);

            // The list re-reads, so the menu now offers the way back out.
            await savedViewsPage.open('Needs review');
            await savedViewsPage.defaultItem(true).click();

            await expect(
                savedViewsPage.toast(/Cleared your default view/)
            ).toBeVisible();
            expect(spy.cleared).toBe(1);
        });

        test('the save dialog’s default checkbox is confirmed too', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, []);
            const spy = spySaveView(page);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.saveAs();
            await savedViewsPage.nameInput().fill('My slice');
            await savedViewsPage.makeDefault().click();
            await savedViewsPage.submit().click();

            expect(spy.lastBody?.makeDefault).toBe(true);
            await expect(
                savedViewsPage.toast(
                    /“My slice” saved and set as your default view/
                )
            ).toBeVisible();
        });
    });

    test('a link with its own params beats the default view', async ({
        page,
        savedViewsPage
    }) => {
        // A deep link out of a mail or a chat has to show what its sender saw.
        await seed(page, [{ ...NEEDS_REVIEW_VIEW, isDefault: true }]);
        await savedViewsPage.goto(
            RELATIONS_WORKSPACE.id,
            'article',
            '?q=gdansk'
        );

        await expect(savedViewsPage.activeTab()).toContainText('All records');
        expect(new URL(page.url()).searchParams.get('view')).toBeNull();
    });
    test.describe('the menu on each tab', () => {
        test('renames a view in place with F2', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spyUpdateView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.tab('Needs review').focus();
            await page.keyboard.press('F2');
            await expect(savedViewsPage.renameField()).toBeFocused();
            await expect(savedViewsPage.renameField()).toHaveValue(
                'Needs review'
            );

            await page.keyboard.type('Ready to edit');
            await page.keyboard.press('Enter');

            await expect(savedViewsPage.tab('Ready to edit')).toBeVisible();
            await expect(savedViewsPage.tab('Ready to edit')).toBeFocused();
            expect(spy.count).toBe(1);
            expect(spy.lastBody).toEqual({ name: 'Ready to edit' });
        });

        test('Escape cancels a rename and sends nothing', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spyUpdateView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.open('Needs review');
            await savedViewsPage.menuItem('Rename').click();
            await expect(savedViewsPage.renameField()).toBeFocused();
            await page.keyboard.type('Never mind');
            await page.keyboard.press('Escape');

            await expect(savedViewsPage.renameField()).toHaveCount(0);
            await expect(savedViewsPage.tab('Needs review')).toBeVisible();
            expect(spy.count).toBe(0);
        });

        test('a taken name keeps the field open and says why', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            spyUpdateView(page, [NEEDS_REVIEW_VIEW], { taken: ['Taken'] });
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.tab('Needs review').dblclick();
            await savedViewsPage.renameField().fill('Taken');
            await page.keyboard.press('Enter');

            await expect(
                savedViewsPage.toast('You already have a view called “Taken”.')
            ).toBeVisible();
            await expect(savedViewsPage.renameField()).toHaveValue('Taken');
        });

        test('someone else’s shared view offers no rename, share or delete', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [SHARED_VIEW]);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.tab('Editorial backlog').click({
                button: 'right'
            });

            await expect(savedViewsPage.menuItem('Duplicate')).toBeVisible();
            await expect(savedViewsPage.menuItem('Copy link')).toBeVisible();
            await expect(savedViewsPage.defaultItem()).toBeVisible();
            await expect(savedViewsPage.menuItem('Rename')).toHaveCount(0);
            await expect(savedViewsPage.deleteItem()).toHaveCount(0);
            await expect(
                page.getByRole('menuitemcheckbox', {
                    name: 'Shared with workspace'
                })
            ).toHaveCount(0);
        });

        test('duplicates a view as a personal copy and opens it', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [SHARED_VIEW]);
            const spy = spySaveView(page);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.open('Editorial backlog');
            await savedViewsPage.menuItem('Duplicate').click();

            await expect.poll(() => spy.count).toBe(1);
            expect(spy.lastBody).toMatchObject({
                name: 'Editorial backlog (copy)',
                visibility: 'private',
                payload: SHARED_VIEW.payload
            });
            await expect(
                savedViewsPage.toast(
                    'Duplicated as “Editorial backlog (copy)”.'
                )
            ).toBeVisible();
        });

        test('shares an own view from its menu', async ({
            page,
            savedViewsPage
        }) => {
            await seed(page, [NEEDS_REVIEW_VIEW]);
            const spy = spyUpdateView(page, [NEEDS_REVIEW_VIEW]);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await savedViewsPage.open('Needs review');
            const share = page.getByRole('menuitemcheckbox', {
                name: 'Shared with workspace'
            });
            await expect(share).toHaveAttribute('aria-checked', 'false');
            await share.click();

            await expect(
                savedViewsPage.toast(
                    '“Needs review” is shared with the workspace.'
                )
            ).toBeVisible();
            expect(spy.lastBody).toEqual({ visibility: 'workspace' });
        });

        test('folds the tabs that don’t fit into “N more”, and brings a pick back', async ({
            page,
            savedViewsPage
        }) => {
            const many = Array.from({ length: 12 }, (_, n) => ({
                ...NEEDS_REVIEW_VIEW,
                id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`,
                name: `A rather long view name ${n + 1}`
            }));
            await seed(page, many);
            await savedViewsPage.goto(RELATIONS_WORKSPACE.id, 'article');

            await expect(savedViewsPage.more()).toBeVisible();
            await expect(
                savedViewsPage.tab('A rather long view name 12')
            ).toHaveCount(0);

            await savedViewsPage.more().click();
            await page.getByPlaceholder('Find a view').fill('name 12');
            await page
                .getByRole('option', { name: 'A rather long view name 12' })
                .click();

            // The selected view always keeps a tab.
            await expect(savedViewsPage.activeTab()).toContainText(
                'A rather long view name 12'
            );
        });
    });
});
