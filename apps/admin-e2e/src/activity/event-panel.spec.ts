import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { ALL_KINDS_ACTIVITY, mockActivity } from '../support/api/activity';

/**
 * The event panel — what one line of the feed says in full: the sentence and
 * its exact time, **what changed** as a before/after table, the actor, the
 * subject as a link, the kind and the event id, the raw metadata folded away,
 * and "More by …" to narrow the log to the actor.
 */
test.describe('Activity event panel', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockActivity(page);
    });

    test('shows a role change as a before/after table', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('changed the role of');

        const panel = activityLogPage.eventPanel();
        await expect(panel).toContainText(
            'ada@orthacms.dev changed the role of a member to Contributor'
        );
        const diff = activityLogPage.diffTable();
        await expect(diff.getByRole('columnheader')).toHaveText([
            'Field',
            'Before',
            'After'
        ]);
        await expect(diff.getByRole('row').nth(1)).toHaveText(
            /Role\s*Viewer\s*Contributor/
        );
        // The kind and the event id, as they are on the wire.
        await expect(panel).toContainText('user.role_changed');
        await expect(panel).toContainText('ev_2');
        // The subject is a member the admin can open.
        await expect(activityLogPage.panelAction('Open User')).toHaveAttribute(
            'href',
            '/users/u_grace'
        );
    });

    test('a field-by-field change reads each recorded transition', async ({
        activityLogPage,
        page
    }) => {
        await mockActivity(page, ALL_KINDS_ACTIVITY);
        await activityLogPage.gotoWith('pageSize=100&range=all');
        await activityLogPage.openEvent('updated the profile of');
        await expect(
            activityLogPage.diffTable().getByRole('row').nth(1)
        ).toHaveText(/Name\s*Ada L\s*Ada B/);

        // An edit that recorded *which* fields changed, and no values, gets no
        // table of blanks — it says what it knows.
        await activityLogPage.openEvent('edited an entry');
        await expect(activityLogPage.diffTable()).toHaveCount(0);
        await expect(activityLogPage.eventPanel()).toContainText(
            'Changed title, body'
        );
    });

    test('links a record into its workspace’s library', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('published Spring launch');

        await expect(activityLogPage.eventPanel()).toContainText(
            'in Marketing site'
        );
        await expect(
            activityLogPage.panelAction('Open Spring launch')
        ).toHaveAttribute(
            'href',
            '/workspaces/ws_marketing/content/article/e_spring'
        );
    });

    test('keeps the raw metadata folded until asked', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('changed the role of');

        const toggle = activityLogPage.rawMetadataToggle();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(activityLogPage.eventPanel()).toContainText(
            '"to": "contributor"'
        );
    });

    test('"More by" narrows the log to the actor, as a removable chip', async ({
        activityLogPage,
        page
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('suspended a member');
        await activityLogPage.panelAction('More by grace@orthacms.dev').click();

        await expect(activityLogPage.eventPanel()).toBeHidden();
        await expect(page).toHaveURL(/filter=/);
        await expect(
            activityLogPage.chip('Actor email equals grace@orthacms.dev')
        ).toBeVisible();
        await expect(activityLogPage.row('ada@orthacms.dev')).toHaveCount(0);
        await expect(activityLogPage.filterTrigger()).toHaveAccessibleName(
            'Filters, 1 applied'
        );

        // Each chip is removable on its own.
        await activityLogPage.chipRemove('Actor email equals').click();
        await expect(page).not.toHaveURL(/filter=/);
        await expect(
            activityLogPage.row('ada@orthacms.dev').first()
        ).toBeVisible();
    });

    test('another row switches the panel; a click elsewhere closes it', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('changed the role of');
        await expect(
            activityLogPage.rowButton('changed the role of')
        ).toHaveAttribute('aria-expanded', 'true');

        await activityLogPage.rowButton('suspended a member').click();
        await expect(activityLogPage.eventPanel()).toContainText(
            'user.suspended'
        );
        await expect(
            activityLogPage.rowButton('suspended a member')
        ).toHaveAttribute('aria-expanded', 'true');
        await expect(
            activityLogPage.rowButton('changed the role of')
        ).toHaveAttribute('aria-expanded', 'false');

        await activityLogPage.heading.click();
        await expect(activityLogPage.eventPanel()).toBeHidden();
    });

    test('a system event offers no "More by" and no dead link', async ({
        activityLogPage
    }) => {
        await activityLogPage.goto();
        await activityLogPage.openEvent('System invited');
        await expect(activityLogPage.panelAction(/^More by/)).toHaveCount(0);
        await expect(activityLogPage.eventPanel()).toContainText('System');
    });
});
