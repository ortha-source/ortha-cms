import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    ALL_KINDS_ACTIVITY,
    DEFAULT_ACTIVITY,
    mockActivity
} from '../support/api/activity';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * The Activity page (`/activity`, `@orthacms/activity-admin`): the audit trail
 * as a day-grouped feed of sentences, the free-text search and the time range
 * driving the `/api/activity` mock, the "System" actor, the workspace suffix,
 * and the `activity:read` gate (no nav entry, a no-access state, no request).
 * The backend is the `GET /api/activity` mock; `mockSignedIn` satisfies the
 * shell's auth probe.
 */
test.describe('Activity page — the feed', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('renders the trail as sentences under day headings', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await expect(activityLogPage.heading).toBeVisible();
        // The gated shell wrapped the page.
        await expect(activityLogPage.nav).toBeVisible();
        await expect(activityLogPage.feed).toBeVisible();

        // Actor, verb, object as one line — not four columns.
        await expect(
            activityLogPage.row(
                'ada@orthacms.dev changed the role of a member to Contributor'
            )
        ).toBeVisible();
        await expect(
            activityLogPage.row('grace@orthacms.dev suspended a member')
        ).toBeVisible();
        // The fixtures are older than yesterday, so their headings are dates.
        await expect(activityLogPage.dayHeading(/Jun 11/)).toBeVisible();
        await expect(activityLogPage.dayHeading(/Jun 10/)).toBeVisible();
        // Deployment-wide, and saying so (see the plugin's AGENTS.md).
        await expect(activityLogPage.subtitle()).toHaveText(
            `${DEFAULT_ACTIVITY.length} events in the last 7 days, across every workspace`
        );
    });

    test('renders a system-initiated event with a "System" actor', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await expect(
            activityLogPage.row('System invited alan@orthacms.dev')
        ).toBeVisible();
    });

    test('names the record and the workspace an action happened in', async ({
        activityLogPage,
        page
    }) => {
        await mockWorkspaces(page);
        await activityLogPage.goto();
        await expect(
            activityLogPage.row(
                'ada@orthacms.dev published Spring launch in Marketing site'
            )
        ).toBeVisible();
    });

    test('one search box finds people, records and actions', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();

        // A person: the actor's address, or the subject's id.
        await activityLogPage.search.fill('katherine');
        await expect(activityLogPage.row('suspended a member')).toBeVisible();
        await expect(activityLogPage.row('ada@orthacms.dev')).toHaveCount(0);

        // A record, by the name the server froze on the row.
        await activityLogPage.search.fill('spring');
        await expect(
            activityLogPage.row('published Spring launch')
        ).toBeVisible();
        await expect(activityLogPage.row('suspended')).toHaveCount(0);

        // An action, in words — "role changed" finds `user.role_changed`.
        await activityLogPage.search.fill('role changed');
        await expect(activityLogPage.row('changed the role of')).toBeVisible();
        await expect(activityLogPage.row('published')).toHaveCount(0);
        await expect(page).toHaveURL(/q=role\+changed|q=role%20changed/);
    });

    test('deep-links the active search into the URL [activity:I-30]', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        await activityLogPage.search.fill('grace');
        await expect(page).toHaveURL(/q=grace/);

        await activityLogPage.gotoWith('q=katherine');
        await expect(activityLogPage.search).toHaveValue('katherine');
        await expect(activityLogPage.row('ada@orthacms.dev')).toHaveCount(0);
    });

    test('a link from before the one search box still finds what it meant', async ({
        activityLogPage,
        page
    }) => {
        // `?actorEmail=` was the page's only search. The free-text one covers
        // the address, so the value moves over rather than being dropped.
        await activityLogPage.gotoWith('actorEmail=grace');
        await expect(page).toHaveURL(/q=grace/);
        await expect(page).not.toHaveURL(/actorEmail=/);
        await expect(activityLogPage.search).toHaveValue('grace');
    });

    test('shows the filtered empty state when the search matches nothing', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.search.fill('nobody-xyz');

        await expect(
            activityLogPage.emptyText('No activity matches')
        ).toBeVisible();
        await expect(activityLogPage.subtitle()).toHaveText('No events match');
    });

    /**
     * The range as a request, because the mock does not apply it (the fixtures
     * are fixed dates and the range is relative to today). What the page owes
     * the server is the right bound: local midnight six days ago by default,
     * and none at all for "All time".
     */
    test('opens on the last 7 days and asks for exactly that [activity:I-30]', async ({
        activityLogPage,
        page
    }) => {
        const froms: (string | null)[] = [];
        page.on('request', (request) => {
            const url = new URL(request.url());
            if (url.pathname === '/api/activity') {
                froms.push(url.searchParams.get('from'));
            }
        });
        await activityLogPage.goto();
        await expect(activityLogPage.feed).toBeVisible();
        await expect(activityLogPage.rangeSelect).toHaveText(/Last 7 days/);

        const expected = await page.evaluate(() => {
            const now = new Date();
            return new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - 6
            ).toISOString();
        });
        expect(froms.at(-1)).toBe(expected);

        await activityLogPage.chooseRange('All time');
        await expect(page).toHaveURL(/range=all/);
        await expect.poll(() => froms.at(-1)).toBeNull();
        await expect(activityLogPage.subtitle()).toHaveText(
            `${DEFAULT_ACTIVITY.length} events across every workspace`
        );
    });

    test('a quiet week offers the whole log instead of "no activity yet"', async ({
        activityLogPage,
        page
    }) => {
        await mockActivity(page, []);
        await activityLogPage.goto();
        await expect(
            activityLogPage.emptyText('Nothing happened in this period')
        ).toBeVisible();

        await activityLogPage.showAllTime().click();
        await expect(page).toHaveURL(/range=all/);
        await expect(
            activityLogPage.emptyText('No activity yet')
        ).toBeVisible();
        // The button that was pressed is gone; focus is not.
        await expect(activityLogPage.search).toBeFocused();
    });

    /**
     * The gate, asserted where it is actually made rather than where it shows:
     * an unconditional query would render the same no-access screen having
     * asked the server for an audit log the caller may not read. What
     * separates the two is the request, so the request is what this counts.
     */
    test('makes no request at all without activity:read [activity:I-28]', async ({
        activityLogPage,
        page
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'users:read']
        });

        const asked: string[] = [];
        page.on('request', (request) => {
            if (new URL(request.url()).pathname.startsWith('/api/activity')) {
                asked.push(request.url());
            }
        });

        await activityLogPage.goto();

        await expect(activityLogPage.noAccessText()).toBeVisible();
        // The permission-gated nav entry is hidden, and so is the export.
        await expect(activityLogPage.navButton).toHaveCount(0);
        await expect(activityLogPage.exportButton).toHaveCount(0);

        // A wall-clock settle, because the assertion is an **absence**: there
        // is no event to wait for when the correct behaviour is that nothing
        // happens.
        await page.waitForTimeout(500);
        expect(asked).toEqual([]);
    });
});

/**
 * The home dashboard's half of the same gate: `RecentActivityPanel` returns
 * `null` for a caller without `activity:read`, and — the part that needs a
 * browser to see — asks for nothing on the way there.
 *
 * Separate from the page above because the failure is different in kind. The
 * page has somewhere to put a refusal; the panel does not. A panel that
 * rendered an empty card, or a spinner that never resolves, on every viewer's
 * dashboard is the visible symptom; a panel that quietly requests an audit log
 * the viewer cannot read is the one nobody would notice.
 */
test.describe('Recent activity panel — without activity:read', () => {
    test('renders nothing and asks for nothing [activity:I-28]', async ({
        homePage,
        page
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'users:read']
        });
        await mockWorkspaces(page);
        await mockActivity(page);

        const asked: string[] = [];
        page.on('request', (request) => {
            if (new URL(request.url()).pathname.startsWith('/api/activity')) {
                asked.push(request.url());
            }
        });

        await homePage.goto();

        // The dashboard itself rendered — the sibling panel from
        // `workspaces-admin` is there — so the activity panel's absence is a
        // decision it made and not a page that failed to draw.
        await expect(homePage.workspacesPanel).toBeVisible();
        await expect(homePage.activityPanel).toHaveCount(0);

        // Same settle, same reason as the page above.
        await page.waitForTimeout(500);
        expect(asked).toEqual([]);
    });
});

/**
 * The Activity Log's resilience to values it does not control: a hand-edited
 * URL param the server would reject, and a timestamp the API should never send.
 * Both are read-only surfaces, so neither can be reached by using the app —
 * which is exactly why neither was covered.
 */
test.describe('Activity Log resilience', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
    });

    /**
     * Where the page number is allowed to be, and it is a two-sided rule.
     *
     * Narrowing a filter must not strand somebody on an empty page past the
     * end — but the same correction, run a moment too early, would throw away
     * a deep-linked `?page=N` before the first response has said how many
     * pages there are. The guard is that the clamp runs only once real data
     * has arrived; both halves are asserted here because a fix for either one
     * alone reintroduces the other.
     */
    test.describe('the page number after the result set changes', () => {
        /** Enough events that a page size of 25 leaves more than one page. */
        const MANY = Array.from({ length: 60 }, (_, index) => ({
            id: `ev_many_${index}`,
            kind: 'user.signed_in',
            subjectType: 'user',
            subjectId: 'u_ada',
            actorId: 'u_ada',
            // One event in the set belongs to somebody else, so a search for
            // them narrows sixty results down to a single page.
            actorEmail: index === 0 ? 'grace@orthacms.dev' : 'ada@orthacms.dev',
            meta: null,
            at: '2026-06-10T09:00:00.000Z'
        }));

        test('comes back to the last page when a filter leaves fewer [activity:I-29]', async ({
            page,
            activityLogPage
        }) => {
            await mockActivity(page, MANY);
            await activityLogPage.gotoWith('page=3');
            await expect(activityLogPage.feed).toBeVisible();

            // Sixty events narrow to one. Page three no longer exists.
            await activityLogPage.search.fill('grace');

            await expect(
                activityLogPage.row('grace@orthacms.dev').first()
            ).toBeVisible();
            // The address is corrected too — a URL that says page three while
            // showing page one is a link that reopens wrong.
            await expect(page).toHaveURL(
                (url) => !url.searchParams.has('page')
            );
        });

        test('keeps a deep-linked page instead of resetting it on arrival [activity:I-29]', async ({
            page,
            activityLogPage
        }) => {
            // The other half: before the first response `total` is 0 and the
            // page count reads as 1, so an unguarded correction would send a
            // shared link to page one every time.
            await mockActivity(page, MANY, { delayMs: 150 });
            await activityLogPage.gotoWith('page=3');

            await expect(activityLogPage.feed).toBeVisible();
            await expect(page).toHaveURL(/page=3/);
        });
    });

    test('an over-large ?pageSize is clamped instead of 400ing into a dead end [activity:I-18]', async ({
        activityLogPage,
        page
    }) => {
        // `mockActivity` refuses a `pageSize` above 100 with a 400, the way the
        // DTO's `@Max` makes the real API refuse it. That refusal is the whole
        // test: while the mock echoed any page size back with a 200, an
        // unclamped request rendered a table identical to a clamped one and this
        // case passed with the clamp deleted.
        //
        // More than 100 events, so the clamped page is a full one — that is what
        // separates a ceiling at the largest size the server serves from a
        // retreat to the default 25, which would also dodge the 400.
        const OVER_A_PAGE = Array.from({ length: 120 }, (_, index) => ({
            id: `ev_over_${index}`,
            kind: 'user.signed_in',
            subjectType: 'user',
            subjectId: 'u_ada',
            actorId: 'u_ada',
            actorEmail: 'ada@orthacms.dev',
            meta: null,
            at: '2026-06-10T09:00:00.000Z'
        }));
        await mockActivity(page, OVER_A_PAGE);
        await activityLogPage.gotoWith('pageSize=1000');

        // A 400 here is unrecoverable: the rows-per-page Select is the only
        // control that could fix it, and it lives inside the data branch that a
        // failed query never renders — so Retry re-issued the same doomed
        // request forever and the only way out was hand-editing the URL again.
        // (A 4xx skips the query client's retry, so the error state, if it came,
        // would be on screen at once rather than seven seconds later.)
        await expect(activityLogPage.feed).toBeVisible();
        await expect(activityLogPage.errorAlert()).toHaveCount(0);
        await expect(page.getByText('Rows per page')).toBeVisible();

        // And the clamp is a ceiling, not a reset to the default: the request
        // that succeeded asked for the largest page the server will serve. The
        // URL is left alone — the clamp happens on the way out, not by rewriting
        // what the reader typed.
        await expect(page).toHaveURL(/pageSize=1000/);
        await expect(activityLogPage.resultsStatus()).toContainText(
            'Showing 1–100'
        );
    });

    test('a malformed timestamp does not take the whole app down', async ({
        homePage,
        page
    }) => {
        await mockWorkspaces(page);
        await mockActivity(page, [
            { ...DEFAULT_ACTIVITY[0], id: 'ev_bad', at: 'not-a-date' }
        ]);
        await homePage.goto();

        // `new Date('not-a-date')` is an Invalid Date, and `toISOString()`
        // *throws* on one. The home panel called it unguarded to fill its
        // `<time datetime>`, so a single bad row threw inside render and — with
        // no error boundary above the home slots — React unmounted the entire
        // tree to a blank page. The rest of the dashboard must survive it.
        await expect(homePage.heading).toBeVisible();
        await expect(homePage.activityPanel).toBeVisible();
        await expect(homePage.workspacesPanel).toBeVisible();
    });
});

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Activity page and its states.
 * A regression guard, not a conformance claim.
 */
test.describe('Activity page accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockActivity(page);
    });

    test('feed — initial', async ({ activityLogPage, makeAxe }) => {
        await activityLogPage.goto();
        await activityLogPage.feed.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('feed — event panel open', async ({ activityLogPage, makeAxe }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('changed the role of');
        await activityLogPage.diffTable().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('feed — loading skeleton', async ({
        activityLogPage,
        page,
        makeAxe
    }) => {
        await mockActivity(page, undefined, { delayMs: 30_000 });
        await activityLogPage.goto();
        await activityLogPage.tableSkeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ activityLogPage, makeAxe }) => {
        await activityLogPage.goto();
        await activityLogPage.search.fill('nobody-xyz');
        await activityLogPage.emptyText('No activity matches').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — nothing in the range', async ({
        activityLogPage,
        page,
        makeAxe
    }) => {
        await mockActivity(page, []);
        await activityLogPage.goto();
        await activityLogPage
            .emptyText('Nothing happened in this period')
            .waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('no-access state', async ({ activityLogPage, makeAxe, page }) => {
        await mockSignedIn(page, { permissions: [] });
        await activityLogPage.goto();
        await activityLogPage.noAccessText().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    // The theme defaults to `system`, so emulating the OS preference flips the
    // whole page without touching app internals — the dark palette (muted text
    // on the day headings, the tinted tiles and the selected row) gets its own
    // scan.
    test('feed — dark theme', async ({ activityLogPage, makeAxe, page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await activityLogPage.goto();
        await activityLogPage.feed.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('feed — dark theme, event panel open', async ({
        activityLogPage,
        makeAxe,
        page
    }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await activityLogPage.goto();
        await activityLogPage.openEvent('changed the role of');
        await activityLogPage.diffTable().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * The feed's assistive-technology semantics — the parts axe cannot see
 * because they are about what changes, and what the list's shape *means*.
 */
test.describe('Activity page assistive-technology semantics', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
    });

    test('each event is one list item and one button, under a day heading', async ({
        activityLogPage,
        page
    }) => {
        await mockActivity(page);
        await activityLogPage.goto();
        await expect(activityLogPage.feed).toBeVisible();

        // One list item per event — nothing structural in between (the old
        // table's hidden detail rows once doubled the announced row count).
        await expect(activityLogPage.feed.getByRole('listitem')).toHaveCount(
            DEFAULT_ACTIVITY.length
        );
        await expect(activityLogPage.feed.getByRole('button')).toHaveCount(
            DEFAULT_ACTIVITY.length
        );
        // Each row button says it opens a dialog and whether it is open.
        const row = activityLogPage.rowButton('changed the role of');
        await expect(row).toHaveAttribute('aria-haspopup', 'dialog');
        await expect(row).toHaveAttribute('aria-expanded', 'false');
        // Two calendar days in the fixture, two headings.
        await expect(
            activityLogPage.feed.getByRole('heading', { level: 2 })
        ).toHaveCount(2);
    });

    test('the time carries a machine-readable instant', async ({
        activityLogPage,
        page
    }) => {
        await mockActivity(page);
        await activityLogPage.goto();

        const when = activityLogPage
            .row('changed the role of')
            .locator('time')
            .first();
        await expect(when).toHaveAttribute('datetime', DEFAULT_ACTIVITY[1].at);
    });

    test('paging changes the live region, so the turnover is announced', async ({
        activityLogPage,
        page
    }) => {
        // The whole kind catalogue over a 25-row page. The last row's index is
        // derived from the fixture: the catalogue grows every time the server
        // learns a new audit kind, and this is about the *announcement*.
        await mockActivity(page, ALL_KINDS_ACTIVITY);
        await activityLogPage.goto();

        const status = activityLogPage.resultsStatus();
        const PAGE_SIZE = 25;
        const pages = Math.ceil(ALL_KINDS_ACTIVITY.length / PAGE_SIZE);
        expect(pages).toBeGreaterThan(1);

        await expect(status).toContainText(`page 1 of ${pages}`);
        await expect(status).toContainText(`1–${PAGE_SIZE}`);

        for (let step = 1; step < pages; step += 1) {
            await activityLogPage.pageButton('Next page').click();
            await expect(status).toContainText(`page ${step + 1} of ${pages}`);
        }
        await expect(status).toContainText(
            `${(pages - 1) * PAGE_SIZE + 1}–${ALL_KINDS_ACTIVITY.length}`
        );
    });
});

/**
 * Keyboard operability for the Activity page — what axe can't assert: the
 * search filters as you type, a row opens its panel from the keyboard and
 * Escape brings focus back, and clearing the filters does not drop focus.
 */
test.describe('Activity page keyboard operability', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('the search filters as you type', async ({ activityLogPage }) => {
        await activityLogPage.goto();
        await activityLogPage.search.focus();
        await activityLogPage.search.pressSequentially('katherine');

        await expect(
            activityLogPage.row('grace@orthacms.dev').first()
        ).toBeVisible();
        await expect(activityLogPage.row('ada@orthacms.dev')).toHaveCount(0);
    });

    test('a row opens its event from the keyboard, and Escape gives focus back', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        const row = activityLogPage.rowButton('changed the role of');
        await row.focus();
        await page.keyboard.press('Enter');

        await expect(activityLogPage.eventPanel()).toBeVisible();
        await expect(row).toHaveAttribute('aria-expanded', 'true');
        // Focus moved into the panel rather than staying behind it.
        await expect
            .poll(() => activityLogPage.focusIsInsideDialog())
            .toBe(true);

        await page.keyboard.press('Escape');
        await expect(activityLogPage.eventPanel()).toBeHidden();
        await expect(row).toBeFocused();
    });

    test('"Clear filters" hands focus back instead of dropping it on the body', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.search.fill('nobody-xyz');
        await activityLogPage.emptyText('No activity matches').waitFor();

        // Clearing makes the query return rows, so the empty state — and with
        // it the button just activated — unmounts. Focus goes to the search box
        // rather than falling to <body>.
        await activityLogPage.clearFilters().focus();
        await activityLogPage.clearFilters().press('Enter');

        await expect(activityLogPage.feed).toBeVisible();
        await expect(activityLogPage.search).toBeFocused();
    });
});
