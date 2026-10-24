import { test as base, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail
} from '../support/api/content';
import {
    daysAgo,
    mockEntryReview,
    mockRecentlyApproved,
    mockReviewQueue,
    mockRevisionSnapshots
} from '../support/api/protection';
import { ReviewsPage } from '../support/pages/ReviewsPage';

/**
 * Registered here rather than in the shared fixtures, so this suite's page
 * object is the only file it adds to the harness.
 */
const test = base.extend<{ reviewsPage: ReviewsPage }>({
    reviewsPage: async ({ page }, use) => {
        await use(new ReviewsPage(page));
    }
});

const WS = LIBRARY_WORKSPACE.id;
/** The signed-in admin `mockSignedIn` seeds by default. */
const ME = '00000000-0000-0000-0000-000000000001';
const SOMEBODY_ELSE = '00000000-0000-0000-0000-0000000000ff';
const GRACE = '00000000-0000-0000-0000-0000000000a1';

/** The workspace with people the panel can name. */
const NAMED_WORKSPACE = {
    ...LIBRARY_WORKSPACE,
    members: [
        { id: ME, name: 'Amara Okafor', email: 'amara@orthacms.dev' },
        { id: GRACE, name: 'Grace Hopper', email: 'grace@orthacms.dev' },
        ...LIBRARY_WORKSPACE.members
    ]
};

/**
 * The reviewer's queue in a real browser.
 *
 * The page exists because until the mail port lands nothing else tells a
 * reviewer that an approval is wanted, so the questions worth asking here are
 * about **legibility**: does somebody who has not read the ADR learn that work
 * is waiting, whose it is, how much changed and how long it has sat — can they
 * approve it without leaving the queue — and does a failed read say so instead
 * of reading as an empty queue, which would tell a reviewer they are free when
 * they are not.
 */
test.describe('Review queue', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
    });

    test('splits the queue into what is waiting on me and what I asked for', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, [
            { id: 'r1', requestedBy: SOMEBODY_ELSE, reviewerIds: [ME] },
            { id: 'r2', requestedBy: SOMEBODY_ELSE, reviewerIds: [ME] },
            { id: 'r3', requestedBy: ME, reviewerIds: [SOMEBODY_ELSE] },
            // Asked of somebody else: waiting on them, not on me.
            {
                id: 'r4',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [SOMEBODY_ELSE]
            }
        ]);
        await reviewsPage.goto(WS);

        await expect(reviewsPage.waitingTab).toBeVisible();
        // "Waiting on me" is the asks that name me — a request says who was
        // asked, so an ask naming somebody else is in neither tab.
        await expect(reviewsPage.waitingTab).toContainText('2');
        await expect(reviewsPage.mineTab).toContainText('1');
        await expect(reviewsPage.queueRows).toHaveCount(2);

        await reviewsPage.mineTab.click();
        await expect(reviewsPage.queueRows).toHaveCount(1);
    });

    /**
     * Colour is not information. An overdue ask carries the word in a badge,
     * which is the half a greyscale screen and a screen reader depend on.
     */
    test('says an overdue request is overdue, in words', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, [
            {
                id: 'old',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [ME],
                createdAt: daysAgo(5)
            }
        ]);
        await reviewsPage.goto(WS);

        const row = reviewsPage.row('Post old');
        await expect(row.getByText('5 days', { exact: true })).toBeVisible();
        await expect(row.getByText('Overdue', { exact: true })).toBeVisible();
    });

    test('does not call a recent request overdue', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, [
            {
                id: 'new',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [ME],
                createdAt: daysAgo(1)
            }
        ]);
        await reviewsPage.goto(WS);

        await expect(
            reviewsPage.row('Post new').getByText('1 day', { exact: true })
        ).toBeVisible();
        await expect(reviewsPage.emptyText('Overdue')).toHaveCount(0);
    });

    /**
     * Named as every other list names a record — by title, its type by label —
     * and with how much changed since it was live, so a typo and a rewrite do
     * not look alike before anybody opens them.
     */
    test('names each record, its type and how much changed', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, [
            {
                id: 'r1',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [ME],
                entryTitle: 'Spring launch',
                fieldsChanged: 3
            },
            {
                id: 'r2',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [ME],
                entryId: 'abcdef12-0000-4000-8000-000000000000',
                entryTitle: null,
                fieldsChanged: 1
            }
        ]);
        await reviewsPage.goto(WS);

        await expect(
            reviewsPage.queueTable.getByText('Spring launch')
        ).toBeVisible();
        await expect(
            reviewsPage.queueTable.getByText('Blog posts · 3 fields changed')
        ).toBeVisible();
        // No title to show: the id fragment, still saying what it is.
        await expect(
            reviewsPage.queueTable.getByText('Record abcdef12')
        ).toBeVisible();
        await expect(
            reviewsPage.queueTable.getByText('Blog posts · 1 field changed')
        ).toBeVisible();
        await expect(reviewsPage.reviewButton('Spring launch')).toBeVisible();
    });

    test('says the queue is empty when it is', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, []);
        await reviewsPage.goto(WS);

        await expect(
            reviewsPage.emptyText(/nothing is waiting on you/i)
        ).toBeVisible();
    });

    /**
     * ⭐ The one this page must never get wrong. "Nothing is waiting on you" is
     * a claim about the workspace; saying it when the truth is "we could not
     * ask" tells a reviewer they are free when they are not.
     */
    test('a failed read is not an empty queue', async ({
        page,
        reviewsPage
    }) => {
        // A `403`, not a `500`: the app retries 5xx three times with backoff
        // (~12s) before surfacing anything, so a 500 here would be a test of
        // the retry ladder. A settled 4xx is what the policy calls an answer,
        // and it is the realistic failure anyway — a caller whose
        // `content:read` went away mid-session.
        await mockReviewQueue(page, [], { status: 403 });
        await reviewsPage.goto(WS);

        await expect(reviewsPage.failure).toContainText(/could not be loaded/i);
        await expect(
            reviewsPage.emptyText(/nothing is waiting on you/i)
        ).toHaveCount(0);
    });

    test('the tab strip is operable from the keyboard', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, [
            { id: 'r1', requestedBy: SOMEBODY_ELSE, reviewerIds: [ME] },
            { id: 'r2', requestedBy: ME }
        ]);
        await mockRecentlyApproved(page, []);
        await reviewsPage.goto(WS);

        await reviewsPage.waitingTab.focus();
        await expect(reviewsPage.waitingTab).toBeFocused();

        // A real tablist: arrow keys move between the three tabs and select
        // the one they land on.
        await page.keyboard.press('ArrowRight');
        await expect(reviewsPage.mineTab).toBeFocused();
        await expect(reviewsPage.mineTab).toHaveAttribute(
            'aria-selected',
            'true'
        );
        await page.keyboard.press('ArrowRight');
        await expect(reviewsPage.approvedTab).toBeFocused();
    });

    /**
     * The suite navigates by URL, so without this nothing would prove the page
     * is *reachable*. That is the failure this harness warns about by name: a
     * permission-gated contribution whose key is missing renders for nobody
     * while every spec still reports green, and it has shipped that way four
     * times.
     */
    test('is reachable from the workspace nav', async ({
        page,
        reviewsPage
    }) => {
        await mockReviewQueue(page, []);
        await page.goto(`/workspaces/${WS}/content`);

        const link = page.getByRole('link', { name: /^reviews$/i });
        await expect(link).toBeVisible();

        await link.click();
        await expect(reviewsPage.heading).toBeVisible();
    });

    test('has no accessibility violations', async ({
        page,
        reviewsPage,
        makeAxe
    }) => {
        await mockReviewQueue(page, [
            {
                id: 'r1',
                requestedBy: SOMEBODY_ELSE,
                reviewerIds: [ME],
                createdAt: daysAgo(5)
            },
            { id: 'r2', requestedBy: ME, reviewerIds: [SOMEBODY_ELSE] }
        ]);
        await reviewsPage.goto(WS);
        await expect(reviewsPage.heading).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * "Recently approved" — *did I already approve that?* It is the page's one
 * extra read, so it is made only when the tab is opened.
 */
test.describe('Review queue, Recently approved', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [NAMED_WORKSPACE]);
        await mockContentSchema(page);
        await mockReviewQueue(page, []);
    });

    test('is read only once the tab is opened, and says where each approval stands', async ({
        page,
        reviewsPage
    }) => {
        const approved = await mockRecentlyApproved(page, [
            {
                entryId: 'live',
                entryTitle: 'Home',
                requestedBy: GRACE,
                headPublished: true
            },
            {
                entryId: 'moved',
                entryTitle: 'Enterprise plan',
                requestedBy: GRACE,
                approvalCurrent: false
            },
            { entryId: 'kept', entryTitle: 'Pricing FAQ', requestedBy: null }
        ]);
        await reviewsPage.goto(WS);
        await expect(reviewsPage.waitingTab).toBeVisible();
        expect(approved.reads).toBe(0);

        await reviewsPage.approvedTab.click();
        await expect(reviewsPage.approvedTable).toBeVisible();
        expect(approved.reads).toBe(1);

        await expect(
            reviewsPage.row('Home').getByText('Published', { exact: true })
        ).toBeVisible();
        await expect(
            reviewsPage
                .row('Enterprise plan')
                .getByText('Changed since', { exact: true })
        ).toBeVisible();
        await expect(
            reviewsPage.row('Pricing FAQ').getByText('Still counts')
        ).toBeVisible();
        await expect(
            reviewsPage.row('Pricing FAQ').getByText('Nobody asked')
        ).toBeVisible();
    });

    test('says when nothing was approved lately', async ({
        page,
        reviewsPage
    }) => {
        await mockRecentlyApproved(page, []);
        await reviewsPage.goto(WS);
        await reviewsPage.approvedTab.click();

        await expect(
            reviewsPage.emptyText(
                /You have not approved anything in the last 30 days/
            )
        ).toBeVisible();
    });

    test('a failed read is not an empty list', async ({
        page,
        reviewsPage
    }) => {
        await mockRecentlyApproved(page, [], { status: 403 });
        await reviewsPage.goto(WS);
        await reviewsPage.approvedTab.click();

        await expect(reviewsPage.failure).toContainText(/could not be loaded/);
        await expect(
            reviewsPage.emptyText(/You have not approved anything/)
        ).toHaveCount(0);
    });

    test('has no accessibility violations', async ({
        page,
        reviewsPage,
        makeAxe
    }) => {
        await mockRecentlyApproved(page, [
            { entryId: 'live', entryTitle: 'Home', headPublished: true },
            {
                entryId: 'moved',
                entryTitle: 'Enterprise plan',
                requestedBy: GRACE,
                approvalCurrent: false
            }
        ]);
        await reviewsPage.goto(WS);
        await reviewsPage.approvedTab.click();
        await expect(reviewsPage.approvedTable).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * Review and Approve straight from the queue: the side panel shows who asked,
 * how far the approvals got, and the changes since the live version — and
 * Approve, without leaving the page.
 */
test.describe('Review queue, side panel', () => {
    const ENTRY = 'entry-r1';

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [NAMED_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockReviewQueue(page, [
            {
                id: 'r1',
                entryTitle: 'Pricing FAQ',
                requestedBy: GRACE,
                reviewerIds: [ME, 'u_ada'],
                given: 1,
                createdAt: daysAgo(5),
                headRevisionNumber: 2,
                liveRevisionNumber: 1,
                fieldsChanged: 2
            },
            {
                id: 'r2',
                entryTitle: 'Spring launch',
                requestedBy: GRACE,
                reviewerIds: [ME],
                headRevisionNumber: 1,
                liveRevisionNumber: null
            }
        ]);
        await mockRevisionSnapshots(page, 'blog_post', ENTRY, {
            1: { title: 'Pricing questions', category: 'news' },
            2: { title: 'Pricing FAQ', category: 'guide' }
        });
        await mockRevisionSnapshots(page, 'blog_post', 'entry-r2', {
            1: { title: 'Spring launch' }
        });
    });

    /** The board's state: Grace asked me and Ada; Ada approved yesterday. */
    const BOARD_REVIEW = {
        required: 2,
        given: 1,
        headRevisionNumber: 2,
        headRevisionId: 'rev-2',
        approvals: [
            {
                userId: 'u_ada',
                revisionId: 'rev-2',
                revisionNumber: 2,
                createdAt: daysAgo(1)
            }
        ],
        request: {
            id: 'req-1',
            requestedBy: GRACE,
            reviewerIds: [ME, 'u_ada'],
            revisionId: 'rev-1',
            createdAt: daysAgo(5)
        }
    };

    test('shows who asked, how far it got and what changed — then approves', async ({
        page,
        reviewsPage
    }) => {
        const review = await mockEntryReview(page, BOARD_REVIEW);
        await reviewsPage.goto(WS);

        await reviewsPage.review('Pricing FAQ');
        await expect(reviewsPage.panel).toBeVisible();
        await expect(reviewsPage.panelTitle).toHaveText('Pricing FAQ');
        await expect(reviewsPage.panel.getByText('Overdue')).toBeVisible();
        await expect(
            reviewsPage.panel.getByText(
                /Grace Hopper asked you and Ada Lovelace · 5 days ago/
            )
        ).toBeVisible();
        await expect(
            reviewsPage.panel.getByText('Ada approved yesterday')
        ).toBeVisible();

        // Only what changed, the live value struck out beside the new one.
        await expect(reviewsPage.changesTable).toBeVisible();
        await expect(
            reviewsPage.changeRow('Title').locator('del')
        ).toContainText('Pricing questions');
        await expect(
            reviewsPage.changeRow('Title').locator('ins')
        ).toContainText('Pricing FAQ');
        await expect(reviewsPage.changeRow('Category')).toBeVisible();
        await expect(
            reviewsPage.panel.getByText(
                'Approving lets Grace publish. A new save asks again.'
            )
        ).toBeVisible();
        await expect(reviewsPage.openRecordLink).toHaveAttribute(
            'href',
            `/workspaces/${WS}/content/blog_post/${ENTRY}`
        );

        // The server's next answer, once the vote is in.
        review.serve({
            ...BOARD_REVIEW,
            given: 2,
            callerApprovedHead: true
        });
        await reviewsPage.approveButton.click();

        await expect.poll(() => review.writes.length).toBe(1);
        expect(review.writes[0]).toMatchObject({
            method: 'POST',
            action: 'approve'
        });
        await expect(
            reviewsPage.panel.getByText('You approved this version')
        ).toBeVisible();
        await expect(reviewsPage.approveButton).toHaveCount(0);
    });

    test('compares a never-published record against nothing', async ({
        page,
        reviewsPage
    }) => {
        await mockEntryReview(page, {
            ...BOARD_REVIEW,
            headRevisionNumber: 1,
            approvals: []
        });
        await reviewsPage.goto(WS);
        await reviewsPage.review('Spring launch');

        await expect(
            reviewsPage.panel.getByText(
                'Not published yet — everything in it is new'
            )
        ).toBeVisible();
        await expect(
            reviewsPage.changeRow('Title').getByText('Not published')
        ).toBeVisible();
    });

    /** Each reason Approve is missing is a sentence, not a gap. */
    test('says why the author of a version cannot approve it', async ({
        page,
        reviewsPage
    }) => {
        await mockEntryReview(page, { ...BOARD_REVIEW, callerWroteHead: true });
        await reviewsPage.goto(WS);
        await reviewsPage.review('Pricing FAQ');

        await expect(
            reviewsPage.panel.getByText(
                'You wrote this version, so somebody else has to approve it.'
            )
        ).toBeVisible();
        await expect(reviewsPage.approveButton).toHaveCount(0);
    });

    test('switches rows without closing, and hands focus back on Escape', async ({
        page,
        reviewsPage
    }) => {
        await mockEntryReview(page, BOARD_REVIEW);
        await reviewsPage.goto(WS);

        await reviewsPage.review('Pricing FAQ');
        await expect(reviewsPage.panelTitle).toHaveText('Pricing FAQ');
        // The row under review is drawn selected.
        await expect(reviewsPage.row('Pricing FAQ')).toHaveAttribute(
            'data-state',
            'selected'
        );

        // Non-modal: focus is not trapped, so the queue stays operable while
        // the panel is open — the next row's Review switches what it shows.
        // (The panel overlays the table's right edge, as the board draws it,
        // so the row is reached from the keyboard here.)
        await reviewsPage.reviewButton('Spring launch').focus();
        await page.keyboard.press('Enter');
        await expect(reviewsPage.panelTitle).toHaveText('Spring launch');

        await page.keyboard.press('Escape');
        await expect(reviewsPage.panel).toHaveCount(0);
        await expect(reviewsPage.reviewButton('Spring launch')).toBeFocused();
    });

    test('opens from the keyboard and moves focus into the panel', async ({
        page,
        reviewsPage
    }) => {
        await mockEntryReview(page, BOARD_REVIEW);
        await reviewsPage.goto(WS);

        await reviewsPage.reviewButton('Pricing FAQ').focus();
        await page.keyboard.press('Enter');
        await expect(reviewsPage.panel).toBeVisible();
        // Focus moved into the panel, rather than staying on the row.
        await expect(reviewsPage.panel.locator(':focus')).toHaveCount(1);

        await reviewsPage.closeButton.click();
        await expect(reviewsPage.panel).toHaveCount(0);
        await expect(reviewsPage.reviewButton('Pricing FAQ')).toBeFocused();
    });

    test('has no accessibility violations with the panel open', async ({
        page,
        reviewsPage,
        makeAxe
    }) => {
        await mockEntryReview(page, BOARD_REVIEW);
        await reviewsPage.goto(WS);
        await reviewsPage.review('Pricing FAQ');
        await expect(reviewsPage.changesTable).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
