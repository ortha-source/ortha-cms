import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspaceSettingsApi,
    type WorkspaceView
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_settings';

/** The single workspace under test, seeded into the stateful settings mock. */
function seed(): WorkspaceView {
    return {
        id: WORKSPACE_ID,
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        status: 'active',
        members: [
            { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@ortha.dev' },
            { id: 'u_grace', name: 'Grace Hopper', email: 'grace@ortha.dev' }
        ],
        // blog_post + product granted; home + about are addable. product is
        // "locked" (still has entries) in the not-empty test below.
        content: ['blog_post', 'product']
    };
}

/**
 * The workspace settings page (`@ortha-cms/workspaces-admin`), mounted in the
 * shell at `/workspaces/:id/settings`. Drives the four left-rail sections —
 * General, Members, Content, Danger zone — against the stateful
 * `mockWorkspaceSettingsApi`, plus the read-only (viewer) variant and an
 * accessibility scan.
 */
test.describe('Workspace settings page', () => {
    test.describe('as an admin', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed()], {
                lockedContent: { [WORKSPACE_ID]: ['product'] }
            });
        });

        test('renders the section nav and the current general values', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await expect(workspaceSettingsPage.navItem('General')).toBeVisible();
            await expect(workspaceSettingsPage.navItem('Members')).toBeVisible();
            await expect(workspaceSettingsPage.navItem('Content')).toBeVisible();
            await expect(
                workspaceSettingsPage.navItem('Danger zone')
            ).toBeVisible();

            await expect(workspaceSettingsPage.nameInput).toHaveValue(
                'Marketing site'
            );
            await expect(workspaceSettingsPage.slugInput).toHaveValue(
                'marketing-site'
            );
            // Active workspace — no archived badge.
            await expect(
                workspaceSettingsPage.archivedBadge()
            ).toBeHidden();
        });

        test('saves an edited name (save enables only when dirty)', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            // Clean form → save disabled.
            await expect(workspaceSettingsPage.saveButton).toBeDisabled();

            await workspaceSettingsPage.nameInput.fill('Marketing hub');
            await expect(workspaceSettingsPage.saveButton).toBeEnabled();
            await workspaceSettingsPage.saveButton.click();

            await expect(
                workspaceSettingsPage.toast(/Workspace details saved/)
            ).toBeVisible();
        });

        test('assigns an unassigned member and removes an existing one', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Members');

            // The owner (first member) is badged and has no remove control.
            await expect(workspaceSettingsPage.ownerBadge()).toBeVisible();

            // Assign an unassigned directory user.
            await workspaceSettingsPage.memberSearch.fill('Barbara');
            await workspaceSettingsPage.memberOption('Barbara Liskov').click();
            await expect(
                workspaceSettingsPage.toast(/was added to the workspace/)
            ).toBeVisible();
            await expect(
                workspaceSettingsPage.memberRow('barbara@ortha.dev')
            ).toBeVisible();

            // Remove a non-owner member through the confirm dialog.
            await workspaceSettingsPage
                .memberRemoveButton('Grace Hopper')
                .click();
            await workspaceSettingsPage.dialogConfirm('Remove').click();
            await expect(
                workspaceSettingsPage.toast(/was removed from the workspace/)
            ).toBeVisible();
            await expect(
                workspaceSettingsPage.memberRow('grace@ortha.dev')
            ).toBeHidden();
        });

        test('grants a content type and revokes an empty one', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Content');

            // Grant an ungranted page through the pages search + multi-select
            // dialog (About is a standalone page).
            await workspaceSettingsPage.addPagesButton.click();
            await workspaceSettingsPage.addContentSearch.fill('About');
            await workspaceSettingsPage.contentCheckbox('About').click();
            await workspaceSettingsPage.addContentSave.click();
            await expect(
                workspaceSettingsPage.toast(/Content type added/)
            ).toBeVisible();

            // Revoke an empty type (blog_post is not locked): once the entry
            // count resolves to zero, Remove enables.
            await workspaceSettingsPage.contentRemoveButton('Blog posts').click();
            await expect(
                workspaceSettingsPage.removeContentConfirm
            ).toBeEnabled();
            await workspaceSettingsPage.removeContentConfirm.click();
            await expect(
                workspaceSettingsPage.toast(/Content type removed/)
            ).toBeVisible();
        });

        test('blocks revoking a content type that still has entries', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Content');

            // product is locked (reports entries) → the dialog blocks Remove
            // with a warning instead of letting the request 409.
            await workspaceSettingsPage.contentRemoveButton('Products').click();

            await expect(
                workspaceSettingsPage.removeBlockedAlert
            ).toContainText(/still has/);
            await expect(
                workspaceSettingsPage.removeContentConfirm
            ).toBeDisabled();
        });

        test('archives the workspace from the danger zone', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Danger zone');

            await workspaceSettingsPage.archiveButton.click();
            await workspaceSettingsPage.dialogConfirm('Archive').click();

            await expect(
                workspaceSettingsPage.toast(/Workspace archived/)
            ).toBeVisible();
            // The header now badges the archived state.
            await expect(
                workspaceSettingsPage.archivedBadge()
            ).toBeVisible();
        });

        test('deletes the workspace and returns to the grid', async ({
            page,
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Danger zone');

            await workspaceSettingsPage.deleteButton.click();
            // The dialog pre-checks the workspace is empty before enabling
            // Delete (the seed reports zero total entries).
            await expect(workspaceSettingsPage.deleteConfirm).toBeEnabled();
            await workspaceSettingsPage.deleteConfirm.click();

            await expect(page).toHaveURL('/workspaces');
        });
    });

    test.describe('delete guard (workspace still has content)', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed()], {
                // The workspace reports content entries → delete is blocked.
                workspaceEntryCount: { [WORKSPACE_ID]: 2 }
            });
        });

        test('blocks deleting until all content is removed', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Danger zone');

            await workspaceSettingsPage.deleteButton.click();

            await expect(
                workspaceSettingsPage.deleteBlockedAlert
            ).toContainText(/still has/);
            await expect(
                workspaceSettingsPage.deleteConfirm
            ).toBeDisabled();
        });
    });

    test.describe('as a viewer (read-only)', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page, {
                permissions: ['workspaces:read', 'users:read', 'content:read']
            });
            await mockWorkspaceSettingsApi(page, [seed()]);
        });

        test('hides edit controls and the danger tab', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            // General is read-only: no save action.
            await expect(workspaceSettingsPage.saveButton).toBeHidden();
            // Danger zone requires update or delete — hidden for a viewer.
            await expect(
                workspaceSettingsPage.navItem('Danger zone')
            ).toBeHidden();

            // Members tab offers no directory search.
            await workspaceSettingsPage.openSection('Members');
            await expect(workspaceSettingsPage.memberSearch).toBeHidden();

            // Content tab offers no add controls.
            await workspaceSettingsPage.openSection('Content');
            await expect(
                workspaceSettingsPage.addCollectionsButton
            ).toBeHidden();
            await expect(
                workspaceSettingsPage.addPagesButton
            ).toBeHidden();
        });
    });

    test.describe('accessibility', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed()]);
        });

        test('the settings page has no automatically-detectable a11y violations', async ({
            workspaceSettingsPage,
            makeAxe
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await expectNoA11yViolations(makeAxe());
        });
    });
});
