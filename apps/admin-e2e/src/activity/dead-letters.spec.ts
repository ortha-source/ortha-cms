import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    DEAD_LETTERS,
    mockActivity,
    mockDeadLetters,
    spyRetryDeadLetter,
    type DeadLetterSeed
} from '../support/api/activity';

/**
 * The operator action on the Activity page: putting a parked outbox event back
 * in the queue.
 *
 * A parked event is an action the system tried to record and could not, after
 * fifteen failed deliveries — very often an audit row that was never written.
 * Until this shipped the only way to un-park one was a `psql` session, which is
 * a poor answer to "the record of record has a hole in it".
 *
 * Two things about this file's setup are load-bearing:
 *
 * - **The banner had never rendered in an admin-e2e test.** `mockActivity`
 *   listens on `**\/api/activity?*` and a `*` segment does not cross `/`, so it
 *   could never match `/api/activity/dead-letters?limit=5`. The request fell
 *   through, the query errored, and `DeadLetterNotice` returns `null` on error
 *   **by design** — so the whole surface was invisible and nothing was red.
 *   `mockDeadLetters` is its own route for exactly that reason.
 * - **The seed is copied per test.** `spyRetryDeadLetter` splices the array it
 *   is given, which is how a retry actually sticks across the refetch; sharing
 *   the module-level `DEAD_LETTERS` between tests would let one test's retry
 *   decide the next test's fixture.
 */

/** A fresh, independent copy of the parked-event seed. */
function parkedEvents(): DeadLetterSeed[] {
    return DEAD_LETTERS.map((row) => ({ ...row }));
}

test.describe('Activity dead letters', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockActivity(page);
    });

    test('the banner reports the parked events and offers the dialog', async ({
        page,
        activityLogPage
    }) => {
        await mockDeadLetters(page, parkedEvents());
        await activityLogPage.goto();

        // One line: the count, and what it means for the rows below it.
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '3 actions were not recorded. The log below is incomplete.'
        );
        await expect(activityLogPage.deadLettersTrigger()).toBeVisible();
    });

    test('the dialog shows what the banner cannot — the error, the time and the attempts', async ({
        page,
        activityLogPage
    }) => {
        await mockDeadLetters(page, parkedEvents());
        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();

        const dialog = activityLogPage.deadLettersDialog();
        // Named for its count, like the banner.
        await expect(dialog).toHaveAccessibleName(
            '3 actions were not recorded'
        );
        // Each row: what (as the log labels it), when, how often, and why.
        // `lastError` is the single field that tells an operator whether the
        // cause is fixed.
        const published = activityLogPage.deadLetterRow('Published content');
        await expect(published).toContainText('15 attempts');
        await expect(published).toContainText(
            'violates foreign key constraint "activity_events_workspace_id_fkey"'
        );
        await expect(
            activityLogPage.deadLetterRow('Invited member')
        ).toBeVisible();
        // A row whose `lastError` is null says so rather than showing a blank
        // that reads as "no problem".
        await expect(
            activityLogPage.deadLetterRow('Uploaded asset')
        ).toContainText('No message was recorded');
        // The whole list is on screen, so there is no "N of M" to say.
        await expect(activityLogPage.deadLettersCount()).toHaveCount(0);
    });

    test('retrying sends exactly one POST for the row that was pressed, and marks it Queued', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        const retry = await spyRetryDeadLetter(page, parked);

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();

        await activityLogPage.deadLetterRetry('Invited member').click();

        // One call, for the id of the row whose button was pressed — the whole
        // reason the accessible name is row-scoped rather than five "Retry"s.
        await expect.poll(() => retry.count).toBe(1);
        expect(retry.ids).toEqual([DEAD_LETTERS[1].id]);

        // The dialog stays open and the row says what happened to it, even
        // though the refetch has taken it off the parked list.
        await expect(
            activityLogPage.deadLetterQueued('Invited member')
        ).toBeVisible();
        await expect(activityLogPage.deadLettersDialog()).toHaveAccessibleName(
            '2 actions were not recorded'
        );
        // "queued", never "recorded": whether it finally delivers is the
        // dispatcher's business seconds later.
        await expect(
            activityLogPage.toast('Queued to be tried again.')
        ).toBeVisible();
        // Still one: the refetch must not have re-fired the mutation.
        expect(retry.count).toBe(1);

        await activityLogPage.closeDeadLettersDialog();
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '2 actions were not recorded'
        );
    });

    test('retrying the last one keeps the dialog, and closing it hands focus to main', async ({
        page,
        activityLogPage
    }) => {
        const parked = [{ ...DEAD_LETTERS[0] }];
        await mockDeadLetters(page, parked);
        await spyRetryDeadLetter(page, parked);

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();
        await activityLogPage.deadLetterRetry('Published content').click();

        // The list is empty now, but the reader is still looking at the row
        // they retried — the dialog outlives the banner.
        await expect(
            activityLogPage.deadLetterQueued('Published content')
        ).toBeVisible();
        await expect(activityLogPage.deadLettersDialog()).toHaveAccessibleName(
            'Every action is recorded'
        );

        // Closing it: the trigger went with the banner, so Radix would restore
        // focus to a node that no longer exists and the next Tab would restart
        // at the top. Focus goes to `<main>` instead (WCAG 2.4.3).
        await activityLogPage.closeDeadLettersDialog();
        await expect(activityLogPage.deadLetterNotice()).toHaveCount(0);
        await expect
            .poll(() => activityLogPage.focusedElementId())
            .toBe('main-content');
    });

    test('Retry all sends the rows shown, one at a time, in order', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        const retry = await spyRetryDeadLetter(page, parked);

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();
        await expect(
            activityLogPage.deadLettersRetryAll()
        ).toHaveAccessibleName('Retry all 3 events shown');
        await activityLogPage.deadLettersRetryAll().click();

        await expect.poll(() => retry.count).toBe(3);
        // The order the dialog lists them in — newest first — one request each.
        expect(retry.ids).toEqual(DEAD_LETTERS.map((row) => row.id));
        for (const label of [
            'Published content',
            'Invited member',
            'Uploaded asset'
        ]) {
            await expect(activityLogPage.deadLetterQueued(label)).toBeVisible();
        }
        await expect(
            activityLogPage.toast('Queued 3 events to be tried again.')
        ).toBeVisible();
        // Nothing left to send, so nothing to offer.
        await expect(activityLogPage.deadLettersRetryAll()).toHaveCount(0);
    });

    test('Retry all stops at the first real failure', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        const retry = await spyRetryDeadLetter(page, parked, { status: 500 });

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();
        await activityLogPage.deadLettersRetryAll().click();

        await expect(
            activityLogPage.toast(
                'Couldn’t queue the events. 3 were not queued.'
            )
        ).toBeVisible();
        // Whatever broke the first request would break the next two: they
        // were never sent.
        expect(retry.count).toBe(1);
        await expect(
            activityLogPage.deadLetterQueued('Published content')
        ).toHaveCount(0);
    });

    test('a later refetch that reaches zero does not move focus', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        await spyRetryDeadLetter(page, parked);

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();

        // One of three. The list does not reach zero, so this retry is owed
        // nothing about focus — and the banner and its trigger are still there.
        await activityLogPage.deadLetterRetry('Invited member').click();
        await expect(
            activityLogPage.deadLetterQueued('Invited member')
        ).toBeVisible();
        await activityLogPage.closeDeadLettersDialog();
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '2 actions were not recorded'
        );

        // The list now empties by something that is not this reader: the
        // retention sweep took the rest, and the news arrives on the refetch a
        // tab regaining focus fires. The trigger goes with the banner.
        await mockDeadLetters(page, [], { total: 0 });
        await activityLogPage.refetchOnWindowFocus();
        await expect(activityLogPage.deadLetterNotice()).toBeHidden();

        // A wall-clock settle, because the assertion is an **absence**: the
        // focus move is a `useEffect` with no request behind it, so there is
        // nothing to wait for when the correct behaviour is that it does not
        // run. Same shape, and same reason, as the two settles in
        // `audit-log.spec.ts`.
        await page.waitForTimeout(500);

        // The flag the retry above armed must have been spent by the answer
        // that followed it. If it latches, this zero — which this reader did
        // not cause — steals focus to `<main>` from wherever the reader had
        // put it, which is the theft the flag exists to prevent.
        expect(await activityLogPage.focusedElementId()).not.toBe(
            'main-content'
        );
    });

    // A live race, not a hypothetical: the retention sweep and the dispatcher
    // both move rows between the fetch and the click. The two refusals are
    // deliberately indistinguishable server-side — 404 covers an unknown id and
    // one already delivered, 409 a row still climbing its backoff — so the UI
    // must not pretend to tell them apart.
    for (const status of [404, 409]) {
        test(`a ${status} says the event is no longer parked`, async ({
            page,
            activityLogPage
        }) => {
            const parked = parkedEvents();
            await mockDeadLetters(page, parked);
            await spyRetryDeadLetter(page, parked, { status });

            await activityLogPage.goto();
            await activityLogPage.deadLettersTrigger().click();
            await expect(activityLogPage.deadLettersList()).toBeVisible();
            await activityLogPage.deadLetterRetry('Invited member').click();

            await expect(
                activityLogPage.toast('That event is no longer parked.')
            ).toBeVisible();
            // Refused, so the dialog stays open on a list that was refreshed
            // rather than left saying something untrue.
            await expect(activityLogPage.deadLettersDialog()).toBeVisible();
        });
    }

    test('a refused retry refreshes the banner too, not only the dialog', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        // 404 and 409 share one branch; the pair above covers the message, and
        // this covers what the branch does to the cache.
        await spyRetryDeadLetter(page, parked, { status: 404 });

        await activityLogPage.goto();
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '3 actions were not recorded'
        );
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();

        // The sweep takes the row away between the fetch and the click — the
        // race that makes the 404 real rather than hypothetical. The last
        // registered route wins, so every dead-letter GET from here says two.
        await mockDeadLetters(page, parked.slice(1), { total: 2 });
        await activityLogPage.deadLetterRetry('Published content').click();

        await expect(
            activityLogPage.toast('That event is no longer parked.')
        ).toBeVisible();
        // The page the reader is looking at follows…
        await expect(
            activityLogPage.deadLetterRow('Published content')
        ).toHaveCount(0);
        await expect(activityLogPage.deadLettersDialog()).toHaveAccessibleName(
            '2 actions were not recorded'
        );

        // …and so does the banner, which is a **separate cache entry** keyed by
        // its own `limit`. Refreshing only the dialog left it counting a row
        // the client had just been told is gone.
        // Asserted with the dialog closed: a modal Radix dialog `aria-hidden`s
        // the page root, so the banner has no role to be found by while it is
        // up.
        await activityLogPage.closeDeadLettersDialog();
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '2 actions were not recorded'
        );
    });

    test('a 500 gets the generic message, not the “no longer parked” one', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        await spyRetryDeadLetter(page, parked, { status: 500 });

        await activityLogPage.goto();
        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();
        await activityLogPage.deadLetterRetry('Invited member').click();

        await expect(
            activityLogPage.toast('Couldn’t queue that event.')
        ).toBeVisible();
    });

    test('nothing renders at all when nothing is parked', async ({
        page,
        activityLogPage
    }) => {
        await mockDeadLetters(page, [], { total: 0 });
        await activityLogPage.goto();
        await expect(activityLogPage.feed).toBeVisible();

        // Absence, not a zero-state. There is deliberately no "0 problems"
        // row, no placeholder and no reserved space: the normal case is that
        // the log is complete, and a banner saying so every day would train the
        // reader to stop seeing it.
        await expect(activityLogPage.deadLetterNotice()).toHaveCount(0);
        await expect(activityLogPage.deadLettersTrigger()).toHaveCount(0);
    });

    test('the banner stays silent when its own request fails', async ({
        page,
        activityLogPage
    }) => {
        await mockDeadLetters(page, [], { status: 500 });
        await activityLogPage.goto();
        await expect(activityLogPage.feed).toBeVisible();

        // Deliberate, and the opposite of the dialog's rule below: a caveat
        // about a list must never be the reason the page looks broken, and a
        // failed *warning* is not itself news. Changing this would make one
        // flaky sub-request read as "the audit log is broken".
        await expect(activityLogPage.deadLetterNotice()).toHaveCount(0);
    });

    test('the dialog does render its error state, with a way to retry the load', async ({
        page,
        activityLogPage
    }) => {
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        await activityLogPage.goto();
        await expect(activityLogPage.deadLettersTrigger()).toBeVisible();

        // Fail only the dialog's larger page. The last registered route wins,
        // so this replaces the mock above for every dead-letter GET from here.
        await mockDeadLetters(page, [], { status: 500 });
        await activityLogPage.deadLettersTrigger().click();

        // The operator deliberately opened this, so an empty list would be an
        // answer — "nothing is stuck" — and the wrong one. A 5xx is retried
        // three times on a backoff ladder before `isError`.
        await expect(activityLogPage.deadLettersError()).toBeVisible({
            timeout: 20_000
        });
        await expect(activityLogPage.deadLettersReload()).toBeVisible();
        await expect(activityLogPage.deadLettersList()).toHaveCount(0);
    });

    test('an activity:read reader sees the caveat and no way to act on it', async ({
        page,
        activityLogPage
    }) => {
        // Hidden, not disabled-with-an-explanation: a permission this account
        // will never hold has no path through, so a permanently inert button is
        // noise. The notice itself still renders — "3 actions were not
        // recorded" is true for this reader either way.
        await mockSignedIn(page, { permissions: ['activity:read'] });
        const parked = parkedEvents();
        await mockDeadLetters(page, parked);
        const retry = await spyRetryDeadLetter(page, parked);

        await activityLogPage.goto();
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '3 actions were not recorded'
        );
        await expect(activityLogPage.deadLettersTrigger()).toHaveCount(0);
        await expect(activityLogPage.deadLettersDialog()).toHaveCount(0);
        expect(retry.count).toBe(0);
    });

    test('the log page and the dialog ask for different pages of the same list', async ({
        page,
        activityLogPage
    }) => {
        const asked: string[] = [];
        page.on('request', (request) => {
            const url = new URL(request.url());
            if (url.pathname.endsWith('/activity/dead-letters')) {
                asked.push(url.searchParams.get('limit') ?? '');
            }
        });
        await mockDeadLetters(page, parkedEvents(), { total: 42 });
        await activityLogPage.goto();
        // The banner reports the unbounded total, not the page it was handed.
        // Asserted *before* the dialog opens: a modal Radix dialog `aria-hidden`s
        // the page root, so the banner has no role to be found by while it is up.
        await expect(activityLogPage.deadLetterNotice()).toContainText(
            '42 actions were not recorded'
        );

        await activityLogPage.deadLettersTrigger().click();
        await expect(activityLogPage.deadLettersList()).toBeVisible();
        // The dialog's footer counts its own page against that same total.
        await expect(activityLogPage.deadLettersCount()).toContainText(
            'Showing 3 events of 42.'
        );

        // Two limits, two cache entries. They shared one key while the request
        // hard-coded `limit: 5`, so the dialog's answer overwrote the banner's
        // — and the banner's kinds line is computed from `items`, so its copy
        // changed depending on whether the dialog had been opened.
        expect(new Set(asked)).toEqual(new Set(['5', '50']));
    });
});
