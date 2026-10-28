import { test as base, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { LIBRARY_WORKSPACE, mockContentSchema } from '../support/api/content';
import { mockInbox, type InboxItemSeed } from '../support/api/inbox';
import { InboxPage } from '../support/pages/InboxPage';

const test = base.extend<{ inbox: InboxPage }>({
    inbox: async ({ page }, use) => {
        await use(new InboxPage(page));
    }
});

const WS = LIBRARY_WORKSPACE.id;
const yesterday = () => new Date(Date.now() - 36 * 3_600_000).toISOString();

const REQUESTED: InboxItemSeed = {
    id: 'i-requested',
    kind: 'review.requested',
    workspaceId: WS,
    payload: {
        entryTitle: 'Team page',
        contentTypeLabel: 'Pages',
        requesterName: 'Margaret Hamilton',
        required: 2
    }
};
const FLAGGED: InboxItemSeed = {
    id: 'i-flagged',
    kind: 'alarm.flagged',
    workspaceId: WS,
    link: `workspaces/${WS}/alarms`,
    payload: {
        ruleName: 'Author is not published',
        severity: 'error',
        contentTypeLabel: 'Articles',
        newCount: 3
    }
};
const READY: InboxItemSeed = {
    id: 'i-ready',
    kind: 'review.ready',
    workspaceId: WS,
    createdAt: yesterday(),
    readAt: yesterday(),
    payload: {
        entryTitle: 'Spring sale',
        contentTypeLabel: 'Pages',
        required: 2
    }
};

/**
 * The inbox in a real browser: does somebody learn what wants them, where,
 * and how long ago — and does opening it, or "Mark all as read", clear it
 * from the counts everywhere at once.
 */
test.describe('Inbox', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
    });

    test('says what wants the reader, today and earlier', async ({
        page,
        inbox
    }) => {
        await mockInbox(page, [REQUESTED, FLAGGED, READY]);
        await inbox.goto();

        await expect(inbox.heading).toBeVisible();
        const today = inbox.section('Today');
        await expect(
            today.getByText('Margaret Hamilton asked you to review “Team page”')
        ).toBeVisible();
        await expect(
            today.getByText('Alarm “Author is not published” flagged 3 records')
        ).toBeVisible();
        // The severity in words, not only in colour.
        await expect(today.getByText('Error', { exact: true })).toBeVisible();
        await expect(
            inbox
                .section('Earlier')
                .getByText(
                    '“Spring sale” has every approval it needs — you can publish it'
                )
        ).toBeVisible();
        // Where it happened, named from the reader's own workspace list.
        await expect(
            inbox.item(/asked you to review/).getByText(/Library/)
        ).toBeVisible();
    });

    test('counts what is unread, in the sidebar and on the tabs', async ({
        page,
        inbox
    }) => {
        await mockInbox(page, [REQUESTED, FLAGGED, READY]);
        await inbox.goto();

        await expect(inbox.navLink).toHaveAccessibleName(/^Inbox ?, 2 unread$/);
        await expect(inbox.tab(/^All/)).toContainText('2');
        await expect(inbox.tab(/^Reviews/)).toContainText('1');
        await expect(inbox.tab(/^Alarms/)).toContainText('1');
    });

    test('narrows to one tab, and keeps it in the URL', async ({
        page,
        inbox
    }) => {
        await mockInbox(page, [REQUESTED, FLAGGED, READY]);
        await inbox.goto();

        await inbox.tab(/^Alarms/).click();

        await expect(page).toHaveURL(/\/inbox\?tab=alarms$/);
        await expect(inbox.item(/flagged 3 records/)).toBeVisible();
        await expect(inbox.item(/asked you to review/)).toHaveCount(0);
    });

    test('opening an item marks it read and goes where it points', async ({
        page,
        inbox
    }) => {
        const recorder = await mockInbox(page, [REQUESTED]);
        await inbox.goto();

        await inbox
            .item(/asked you to review/)
            .getByRole('link', { name: /^Review:/ })
            .click();

        await expect(page).toHaveURL(new RegExp(`/workspaces/${WS}/reviews$`));
        expect(recorder.read).toEqual(['i-requested']);
    });

    test('marks everything read at once', async ({ page, inbox }) => {
        const recorder = await mockInbox(page, [REQUESTED, FLAGGED]);
        await inbox.goto();

        await inbox.markAll.click();

        expect(recorder.readAll).toEqual([{}]);
        await expect(inbox.navLink).toHaveAccessibleName('Inbox');
        await expect(inbox.markAll).toBeDisabled();
    });

    test('says a failed read is a failed read, not an empty inbox', async ({
        page,
        inbox
    }) => {
        await mockInbox(page, [], { status: 403 });
        await inbox.goto();

        await expect(inbox.failure).toContainText('could not be loaded');
        await expect(page.getByText(/Nothing here yet/)).toHaveCount(0);
    });

    test('says so when there is nothing', async ({ page, inbox }) => {
        await mockInbox(page, []);
        await inbox.goto();

        await expect(page.getByText(/Nothing here yet/)).toBeVisible();
    });

    // Inside a workspace the inbox is a button beside "← Home": the reader
    // still hears about the other workspaces.
    test('is one click away from inside a workspace', async ({
        page,
        inbox
    }) => {
        await mockInbox(page, [REQUESTED, FLAGGED]);
        await page.goto(`/workspaces/${WS}/settings/general`);

        await expect(inbox.headerButton).toHaveAccessibleName(
            'Inbox, 2 unread'
        );
        await inbox.headerButton.click();
        await expect(inbox.heading).toBeVisible();
    });

    test('has no accessibility violations', async ({
        page,
        inbox,
        makeAxe
    }) => {
        await mockInbox(page, [REQUESTED, FLAGGED, READY]);
        await inbox.goto();
        await expect(inbox.section('Today')).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
