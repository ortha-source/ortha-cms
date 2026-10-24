import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    manyWorkspaces,
    mockWorkspaceSettingsApi,
    mockWorkspaces,
    mockWorkspacesApi,
    mockWorkspacesUnavailable,
    spyWorkspaceProbe
} from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';

/**
 * A `5xx` is not the query's final answer: the shared client retries it three
 * times with exponential backoff (~7s) before a hook reports `isError`. An
 * outage is what these tests mean, so the wait is budgeted rather than traded
 * for a fast-failing `4xx`.
 */
const AFTER_RETRIES = { timeout: 15_000 };

/**
 * The Workspaces page (`@orthacms/workspaces-admin`). The table reads
 * `GET /api/workspaces`, stubbed by `mockWorkspaces` (the FE analog of seeded
 * rows): four Active workspaces (Marketing site, Product docs, Support hub,
 * Internal wiki) and two Archived (Research archive, Events 2023); Product docs
 * has five members. The auth probe is stubbed too, since the page sits behind
 * the shell's gate.
 */
test.describe('Workspaces page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('renders the active workspaces by default behind the shell', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await expect(workspacesPage.heading).toBeVisible();
        await expect(workspacesPage.nav).toBeVisible();
        // Default filter is Active: active cards show, archived are hidden.
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText(
            '4 workspaces shown of 6.'
        );
    });

    test('search narrows the table and updates the count', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.fill('Marketing');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Support hub')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText(
            '1 workspace shown of 6.'
        );
    });

    test('the status filter switches to archived and marks the chip active', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('Archived');

        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.card('Marketing site')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText(
            '2 workspaces shown of 6.'
        );
        // The chosen chip is the checked radio in the segmented filter.
        await expect(workspacesPage.statusOption('Archived')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    test('the status filter can show all workspaces', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.filterByStatus('All');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText(
            '6 workspaces shown of 6.'
        );
    });

    test('shows a contextual empty state when nothing matches', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.fill('nonexistent-workspace-xyz');

        await expect(
            workspacesPage.emptyText('No workspaces match')
        ).toBeVisible();
        // Clearing widens to every workspace (status → All, search reset).
        await workspacesPage.clearFiltersButton().click();
        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Research archive')).toBeVisible();
        await expect(workspacesPage.count()).toHaveText(
            '6 workspaces shown of 6.'
        );
    });

    test('a card says what is inside and when it last moved', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        const docs = workspacesPage.card('Product docs');
        // Records and content types instead of a bare member count…
        await expect(docs.getByText('1,204 records')).toBeVisible();
        await expect(docs.getByText('0 content types')).toBeVisible();
        // …who is in it as faces (four, then "+1"), read once as a roster…
        await expect(docs.getByText('+1', { exact: true })).toBeVisible();
        await expect(
            docs.getByRole('img', { name: /^5 members: Grace Hopper/ })
        ).toBeVisible();
        // …and when it last moved (the seed is stamped relative to the run,
        // so the minutes may have ticked on since).
        await expect(docs.getByText('Edited 1 hr. ago')).toBeVisible();
        await expect(
            workspacesPage
                .card('Marketing site')
                .getByText(/^Edited 1\d min\. ago$/)
        ).toBeVisible();
    });

    test('sorts by last edit by default, and by name on request', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        // The busy workspaces first; Internal wiki sends no timestamp, so it
        // sorts last.
        await expect(workspacesPage.sort).toHaveText(/Recently edited/);
        expect(await workspacesPage.cardNames()).toEqual([
            'Marketing site',
            'Product docs',
            'Support hub',
            'Internal wiki'
        ]);

        await workspacesPage.sortBy('Name');
        expect(await workspacesPage.cardNames()).toEqual([
            'Internal wiki',
            'Marketing site',
            'Product docs',
            'Support hub'
        ]);
    });

    test('a row opens its workspace on click', async ({
        page,
        workspacesPage
    }) => {
        // The Content Library (the workspace's first rail section) reads the
        // type catalogue from `GET /api/content-schema`; stub it so the landing
        // pane renders for the granted workspace.
        await mockContentSchema(page);
        await workspacesPage.goto();

        await workspacesPage.openButton('Marketing site').click();

        // The card opens the workspace shell, which redirects the base to its
        // first rail section (Content Library) and shows its overview, titled
        // with the workspace's name.
        await expect(page).toHaveURL('/workspaces/ws_marketing/content');
        await expect(
            page.getByRole('heading', { level: 1, name: 'Marketing site' })
        ).toBeVisible();
    });

    test('a workspace the user is not a member of shows a no-access screen', async ({
        page
    }) => {
        // `GET /api/workspaces` is membership-scoped server-side, so a
        // workspace the user doesn't belong to simply isn't in the list — the
        // shell can't resolve the `:id` and renders the no-access state instead
        // of the workspace. Deep-linking is the only way to reach this.
        await page.goto('/workspaces/ws_not_a_member');

        const noAccess = page.getByRole('alert');
        await expect(
            noAccess.getByText('You don’t have access to this workspace')
        ).toBeVisible();
        await expect(
            noAccess.getByText(/You’re not a member of this workspace/)
        ).toBeVisible();

        // None of the workspace's chrome leaks: no rail, no switcher.
        await expect(
            page.getByRole('button', { name: /Switch workspace/ })
        ).toBeHidden();

        // And the way out goes back to the list the user can see.
        await noAccess
            .getByRole('link', { name: 'Back to workspaces' })
            .click();
        await expect(page).toHaveURL('/workspaces');
    });

    // workspaces:I-03 on the admin side. The server answers a workspace you may not see
    // the same way whether or not it exists; the admin has to keep that
    // promise, and it does so by never asking — the shell resolves `:id`
    // against the membership-scoped list it already holds.
    test('a missing workspace and one you are not in read identically [workspaces:I-03]', async ({
        page,
        workspacesPage
    }) => {
        // Two ids the server would answer differently, so an existence probe
        // would have something to leak.
        const probe = await spyWorkspaceProbe(page, {
            ws_ghost: 404,
            ws_private: 403
        });

        await page.goto('/workspaces/ws_ghost');
        await expect(workspacesPage.shellMessage()).toContainText(
            'You don’t have access to this workspace'
        );
        // Captured rather than compared to a literal: what matters is that the
        // second screen says *the same thing*, whatever that is.
        const ghost = await workspacesPage.shellMessageText();

        await page.goto('/workspaces/ws_private');
        // Word for word: a "does it exist?" probe that softened the copy for
        // one of the two would fail here rather than ship.
        await expect(workspacesPage.shellMessage()).toHaveText(ghost);

        // And nothing was asked, so nothing could leak.
        expect(probe.count).toBe(0);
    });

    // workspaces:I-31 — a failed read is not an empty membership. Every surface that lists
    // workspaces degrades to "none" when the list query fails, and "none" is a
    // sentence the operator will act on.
    test.describe('a broken list is not an empty one', () => {
        test.beforeEach(async ({ page }) => {
            // Registered after the outer mock, so this endpoint breaks and the
            // rest of the seed stands.
            await mockWorkspacesUnavailable(page);
        });

        test('the list page alerts, withholds the empty copy, and retries [workspaces:I-31]', async ({
            page,
            workspacesPage
        }) => {
            await workspacesPage.goto();

            await expect(workspacesPage.errorAlert()).toContainText(
                'Couldn’t load workspaces. Please try again.',
                AFTER_RETRIES
            );
            // The misreading this exists to prevent: an admin told the account
            // has no workspaces starts creating one.
            await expect(
                workspacesPage.emptyText('No workspaces yet')
            ).toBeHidden();

            // Retry refetches rather than decorating a dead page: point the
            // endpoint back at the seed and the rows arrive without a reload.
            await mockWorkspaces(page);
            await workspacesPage.retryButton().click();

            await expect(workspacesPage.card('Marketing site')).toBeVisible();
            await expect(workspacesPage.errorAlert()).toBeHidden();
        });

        test('the workspace shell says the load failed, not that access is denied', async ({
            page,
            workspacesPage
        }) => {
            // The shell resolves `:id` against the list; when the list itself
            // failed, "not in it" is unknown, not false — so a member of this
            // very workspace must not be told they are not a member of it.
            await page.goto('/workspaces/ws_marketing');

            await expect(workspacesPage.shellMessage()).toContainText(
                'Couldn’t load workspaces',
                AFTER_RETRIES
            );
            await expect(workspacesPage.shellMessage()).not.toContainText(
                'You don’t have access to this workspace'
            );
        });

        test('the sidebar quick-list says so instead of collapsing to a heading', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();

            // The nav aid is the surface with the least room to explain itself,
            // which is exactly how it came to say nothing: on error `data` is
            // undefined, so every branch rendered what a genuinely empty
            // membership renders — a bare heading, or no section at all.
            await expect(workspacesPage.sidebarWorkspacesError()).toBeVisible(
                AFTER_RETRIES
            );
            // And no disclosure pretending there are rows behind it.
            await expect(workspacesPage.sidebarWorkspacesToggle).toBeHidden();
        });
    });

    // ORT-174 — the quick-list grew with the user's membership and pushed the
    // sections below it out of the sidebar, with no way to fold it away.
    test.describe('sidebar Workspaces section', () => {
        test('ships expanded, listing the active workspaces', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();

            await expect(
                workspacesPage.sidebarWorkspacesToggle
            ).toHaveAttribute('aria-expanded', 'true');
            await expect(
                workspacesPage.sidebarWorkspaceLink('Marketing site')
            ).toBeVisible();
            // Archived workspaces never joined the quick-list.
            await expect(
                workspacesPage.sidebarWorkspaceLink('Research archive')
            ).toBeHidden();
        });

        test('collapses and expands from the heading, flipping aria-expanded', async ({
            workspacesPage
        }) => {
            await workspacesPage.goto();

            await workspacesPage.collapseSidebarWorkspaces();
            await expect(
                workspacesPage.sidebarWorkspacesToggle
            ).toHaveAttribute('aria-expanded', 'false');
            // Radix unmounts the closed content, so the rows are gone from the
            // tree entirely — not merely hidden behind a zero height.
            await expect(
                workspacesPage.sidebarWorkspaceLink('Marketing site')
            ).toBeHidden();
            await expect(workspacesPage.sidebarWorkspacesNav).toBeHidden();

            await workspacesPage.expandSidebarWorkspaces();
            await expect(
                workspacesPage.sidebarWorkspacesToggle
            ).toHaveAttribute('aria-expanded', 'true');
            await expect(
                workspacesPage.sidebarWorkspaceLink('Marketing site')
            ).toBeVisible();
        });

        test('stays a plain heading when there is nothing to reveal', async ({
            page,
            workspacesPage
        }) => {
            // No rows → no `Collapsible` at all. Radix only emits
            // `aria-controls` on an *open* trigger, and the group opens by
            // default, so a trigger with an unmounted body would leave a
            // dangling idref on every page that carries the sidebar.
            await mockWorkspaces(page, []);
            await workspacesPage.goto();

            await expect(workspacesPage.sidebarWorkspacesToggle).toBeHidden();
            // The "+" survives — it is what invites creating the first one.
            await expect(
                workspacesPage.sidebarNewWorkspaceAction
            ).toBeVisible();
        });

        test('the "+" action still opens the wizard, collapsed or not', async ({
            page,
            workspacesPage
        }) => {
            await workspacesPage.goto();

            // `SidebarGroupAction` is absolutely positioned over the same row
            // the collapse trigger now occupies, so this is the collision the
            // fix has to keep clear — the "+" must act, not toggle.
            await workspacesPage.sidebarNewWorkspaceAction.click();
            await expect(page).toHaveURL(/\/workspaces\/new$/);
            await expect(
                workspacesPage.sidebarWorkspacesToggle
            ).toHaveAttribute('aria-expanded', 'true');

            await page.goBack();
            await workspacesPage.collapseSidebarWorkspaces();
            await workspacesPage.sidebarNewWorkspaceAction.click();
            await expect(page).toHaveURL(/\/workspaces\/new$/);
        });
    });

    // ORT-175 — with a long membership the switcher's popover grew unbounded,
    // and a long workspace name widened it instead of being clipped.
    test.describe('workspace switcher popover', () => {
        test('scrolls its list while the heading and create action stay put', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockWorkspaceSettingsApi(page, manyWorkspaces(30));
            await workspaceSettingsPage.goto('ws_many_1');

            await workspaceSettingsPage.openWorkspaceSwitcher();

            const popover =
                await workspaceSettingsPage.workspaceSwitcherPopover.boundingBox();
            // 30 rows unbounded is ~1500px tall; the list is capped instead.
            expect(popover?.height).toBeLessThan(500);

            await expect(
                workspaceSettingsPage.switcherHeadingText
            ).toBeVisible();
            await expect(workspaceSettingsPage.switcherCreate).toBeVisible();

            const headingBefore =
                await workspaceSettingsPage.switcherHeadingText.boundingBox();
            const createBefore =
                await workspaceSettingsPage.switcherCreate.boundingBox();

            // The last row is only reachable by scrolling the list…
            await workspaceSettingsPage
                .switcherOption('Workspace 30')
                .scrollIntoViewIfNeeded();
            await expect(
                workspaceSettingsPage.switcherOption('Workspace 30')
            ).toBeVisible();

            // …and doing so must not carry the heading or the create action
            // away, which is what putting the scroll on `PopoverContent` did.
            const headingAfter =
                await workspaceSettingsPage.switcherHeadingText.boundingBox();
            const createAfter =
                await workspaceSettingsPage.switcherCreate.boundingBox();
            expect(headingAfter?.y).toBeCloseTo(headingBefore?.y ?? -1, 0);
            expect(createAfter?.y).toBeCloseTo(createBefore?.y ?? -1, 0);
        });

        test('clips a long workspace name instead of widening the popover', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockWorkspaceSettingsApi(
                page,
                manyWorkspaces(6, { longNames: true })
            );
            await workspaceSettingsPage.goto('ws_many_1');

            const trigger =
                await workspaceSettingsPage.workspaceSwitcher.boundingBox();
            await workspaceSettingsPage.openWorkspaceSwitcher();
            const popover =
                await workspaceSettingsPage.workspaceSwitcherPopover.boundingBox();

            // The popover is locked to `max(trigger width, min-w-64)` — 256px,
            // the panel's floor, which is what wins over the ~239px sidebar
            // trigger. The Tailwind v3 spelling of the width class emitted an
            // invalid declaration under v4, so the panel had no width rule at
            // all and grew to the longest name instead: several times this.
            const MIN_POPOVER_WIDTH = 256;
            const locked = Math.max(trigger?.width ?? 0, MIN_POPOVER_WIDTH);
            expect(popover?.width).toBeLessThanOrEqual(locked + 1);
            expect(popover?.width).toBeGreaterThanOrEqual(
                (trigger?.width ?? 0) - 1
            );

            const longName =
                'Workspace 2 with a deliberately overlong name that no sidebar column can fit';
            const row = await workspaceSettingsPage
                .switcherOption(longName)
                .boundingBox();
            expect(row?.width).toBeLessThanOrEqual((popover?.width ?? 0) + 1);

            // Clipped by CSS, not merely laid out narrow: the text really is
            // wider than the box drawing it.
            expect(
                await workspaceSettingsPage.switcherOptionNameIsClipped(
                    longName
                )
            ).toBe(true);
        });
    });

    test.describe('create wizard', () => {
        test.beforeEach(async ({ page }) => {
            // Stateful create flow: the list GET reflects POSTed workspaces, plus
            // the wizard's slug/users/content-type reads.
            await mockWorkspacesApi(page);
        });

        test('creates a workspace and shows it in the grid', async ({
            page,
            workspacesPage,
            createWorkspacePage,
            workspaceReadyPage
        }) => {
            await workspacesPage.goto();
            await workspacesPage.openCreate();
            await expect(createWorkspacePage.heading).toBeVisible();
            await expect(page).toHaveURL(/\/workspaces\/new$/);

            await createWorkspacePage.create('QA space');

            // It lands on the "ready" screen, not on a toast and the list…
            await expect(page).toHaveURL(/\/workspaces\/ws_qa-space\/ready$/);
            await expect(workspaceReadyPage.heading('QA space')).toBeVisible();

            // …and the new card persists through the post-create refetch (not
            // just the optimistic insert).
            await workspaceReadyPage.backToWorkspaces.click();
            await expect(workspacesPage.card('QA space')).toBeVisible();
            await expect(workspacesPage.count()).toHaveText(
                '5 workspaces shown of 7.'
            );
        });

        test('keeps Continue disabled until the basics are valid', async ({
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await expect(createWorkspacePage.continueButton).toBeDisabled();

            await createWorkspacePage.nameInput.fill('QA space');

            // Enables once the auto-filled address is confirmed available,
            // which the field says inline.
            await expect(createWorkspacePage.slugInput).toHaveValue('qa-space');
            await expect(
                createWorkspacePage.slugStatus('Available')
            ).toBeVisible();
            await expect(createWorkspacePage.continueButton).toBeEnabled();
        });

        test('returns to the list via the "Workspaces" breadcrumb', async ({
            page,
            workspacesPage,
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await createWorkspacePage.workspacesCrumb.click();

            await expect(page).toHaveURL(/\/workspaces$/);
            await expect(workspacesPage.heading).toBeVisible();
        });

        test('lets the owner pick an accent color', async ({
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await createWorkspacePage.colorSwatch('teal').click();

            await expect(
                createWorkspacePage.colorSwatch('teal')
            ).toHaveAttribute('aria-checked', 'true');
        });
    });
});
