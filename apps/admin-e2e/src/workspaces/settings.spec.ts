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

            // Grant an ungranted type via the picker.
            await workspaceSettingsPage.addContentButton.click();
            await workspaceSettingsPage.contentOption('About').click();
            await expect(
                workspaceSettingsPage.toast(/Content type added/)
            ).toBeVisible();

            // Revoke an empty type (blog_post is not locked).
            await workspaceSettingsPage.contentRemoveButton('Blog posts').click();
            await workspaceSettingsPage.dialogConfirm('Remove').click();
            await expect(
                workspaceSettingsPage.toast(/Content type removed/)
            ).toBeVisible();
        });

        test('refuses to revoke a content type that still has entries', async ({
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openSection('Content');

            // product is locked (has entries) → the server answers 409.
            await workspaceSettingsPage.contentRemoveButton('Products').click();
            await workspaceSettingsPage.dialogConfirm('Remove').click();

            await expect(
                workspaceSettingsPage.toast(/still has entries/)
            ).toBeVisible();
            // The grant is untouched — its remove control is still present.
            await expect(
                workspaceSettingsPage.contentRemoveButton('Products')
            ).toBeVisible();
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
            await workspaceSettingsPage.dialogConfirm('Delete workspace').click();

            await expect(page).toHaveURL('/workspaces');
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

            // Content tab offers no add control.
            await workspaceSettingsPage.openSection('Content');
            await expect(
                workspaceSettingsPage.addContentButton
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
