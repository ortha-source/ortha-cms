import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspaceSettingsApi,
    spyWorkspacePatches,
    type WorkspaceView,
    type WorkspacePatchSpy
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_settings';

/** The workspace under test, sharing off unless a test says otherwise. */
function seed(overrides: Partial<WorkspaceView> = {}): WorkspaceView {
    return {
        id: WORKSPACE_ID,
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        status: 'active',
        members: [
            { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@orthacms.dev' }
        ],
        content: ['blog_post'],
        ...overrides
    };
}

/** A second workspace that is already shared — the switcher's badge case. */
const BRAND_HUB: WorkspaceView = {
    id: 'ws_brand',
    name: 'Brand hub',
    slug: 'brand-hub',
    description: 'Shared brand assets.',
    color: 'teal',
    status: 'active',
    members: [{ id: 'u_ada', name: 'Ada Lovelace', email: 'ada@orthacms.dev' }],
    content: ['blog_post'],
    isShared: true
};

/**
 * The **Sharing** card on a workspace's General settings tab
 * (`@orthacms/workspaces-admin`, `WorkspaceSharingSettings`) and the two places
 * the shared flag reads back: the switch itself and the sidebar's workspace
 * switcher. The switch applies on its own — no Save — so each case asserts the
 * exact `PATCH` body it sent, and the "off" case that a cancelled confirmation
 * sent nothing.
 */
test.describe('Workspace sharing', () => {
    let patches: WorkspacePatchSpy;

    test.describe('as an admin', () => {
        test('turning sharing on applies immediately and relabels the switcher', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed(), BRAND_HUB]);
            patches = spyWorkspacePatches(page);
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await expect(workspaceSettingsPage.sharingHeading).toBeVisible();
            await expect(workspaceSettingsPage.sharingSwitch).not.toBeChecked();
            await expect(
                workspaceSettingsPage.switcherSubline('Workspace')
            ).toBeVisible();

            // `click()`, not `check()`: the switch writes before it reports
            // itself checked (see the admin-e2e gotchas).
            await workspaceSettingsPage.sharingSwitch.click();

            await expect(
                workspaceSettingsPage.toast('Workspace is now shared.')
            ).toBeVisible();
            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();
            // Only the flag — never the profile fields riding along.
            expect(patches.bodies).toEqual([{ isShared: true }]);
            // No confirmation for the additive direction.
            await expect(workspaceSettingsPage.stopSharingDialog).toBeHidden();

            // The sidebar reads the same list the PATCH response was written
            // into, so it picks the change up without a reload.
            await expect(
                workspaceSettingsPage.switcherSubline('Shared workspace')
            ).toBeVisible();
            await expect(
                workspaceSettingsPage.workspaceSwitcher
            ).toHaveAccessibleName(
                'Switch workspace, current: Marketing site, shared workspace'
            );
        });

        test('turning sharing off asks first, and cancelling writes nothing', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [
                seed({ isShared: true }),
                BRAND_HUB
            ]);
            patches = spyWorkspacePatches(page);
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();

            await workspaceSettingsPage.sharingSwitch.click();
            await expect(workspaceSettingsPage.stopSharingDialog).toBeVisible();
            await expect(
                workspaceSettingsPage.stopSharingDialog.getByText(
                    'Links from other workspaces will stop showing these records.'
                )
            ).toBeVisible();

            await workspaceSettingsPage.dialogConfirm('Cancel').click();
            await expect(workspaceSettingsPage.stopSharingDialog).toBeHidden();
            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();
            expect(patches.bodies).toEqual([]);

            await workspaceSettingsPage.sharingSwitch.click();
            await workspaceSettingsPage.dialogConfirm('Stop sharing').click();

            await expect(
                workspaceSettingsPage.toast('Workspace is no longer shared.')
            ).toBeVisible();
            await expect(workspaceSettingsPage.sharingSwitch).not.toBeChecked();
            expect(patches.bodies).toEqual([{ isShared: false }]);
            await expect(
                workspaceSettingsPage.switcherSubline('Workspace')
            ).toBeVisible();
        });

        test('disables the switch while its write is in flight', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed()], {
                patchDelayMs: 1_500
            });
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await workspaceSettingsPage.sharingSwitch.click();

            // Shows the state being written, and can't be toggled again.
            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();
            await expect(workspaceSettingsPage.sharingSwitch).toBeDisabled();
            await expect(
                workspaceSettingsPage.toast('Workspace is now shared.')
            ).toBeVisible();
            await expect(workspaceSettingsPage.sharingSwitch).toBeEnabled();
        });

        test('a refused write says so and leaves the switch where it was', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed()], {
                patchStatus: 403
            });
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await workspaceSettingsPage.sharingSwitch.click();

            await expect(
                workspaceSettingsPage.toast(
                    'Couldn’t change sharing. Please try again.'
                )
            ).toBeVisible();
            await expect(workspaceSettingsPage.sharingSwitch).not.toBeChecked();
        });

        test('marks a shared workspace in the switcher popover', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed(), BRAND_HUB]);
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await workspaceSettingsPage.openWorkspaceSwitcher();

            await expect(
                workspaceSettingsPage.switcherSharedBadge('Brand hub')
            ).toBeVisible();
            await expect(
                workspaceSettingsPage.switcherSharedBadge('Marketing site')
            ).toHaveCount(0);
        });
    });

    test.describe('keyboard', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [seed({ isShared: true })]);
        });

        test('the switch toggles from the keyboard; Escape cancels the confirmation and returns focus', async ({
            page,
            workspaceSettingsPage
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await workspaceSettingsPage.sharingSwitch.focus();
            await page.keyboard.press('Space');
            await expect(workspaceSettingsPage.stopSharingDialog).toBeVisible();
            // The trap holds while it is open.
            await expect(workspaceSettingsPage.focusInsideDialog()).toHaveCount(
                1
            );

            await page.keyboard.press('Escape');
            await expect(workspaceSettingsPage.stopSharingDialog).toBeHidden();
            await expect(workspaceSettingsPage.sharingSwitch).toBeFocused();
            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();
        });
    });

    test.describe('as a viewer (no workspaces:update)', () => {
        test('shows the state on a disabled switch', async ({
            page,
            workspaceSettingsPage
        }) => {
            await mockSignedIn(page, {
                permissions: ['workspaces:read', 'users:read', 'content:read']
            });
            await mockWorkspaceSettingsApi(page, [seed({ isShared: true })]);
            await workspaceSettingsPage.goto(WORKSPACE_ID);

            await expect(workspaceSettingsPage.sharingSwitch).toBeChecked();
            await expect(workspaceSettingsPage.sharingSwitch).toBeDisabled();
        });
    });

    test.describe('accessibility', () => {
        test.beforeEach(async ({ page }) => {
            await mockSignedIn(page);
            await mockWorkspaceSettingsApi(page, [
                seed({ isShared: true }),
                BRAND_HUB
            ]);
        });

        test('general tab with the sharing card', async ({
            workspaceSettingsPage,
            makeAxe
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.sharingSwitch.waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('the stop-sharing confirmation', async ({
            workspaceSettingsPage,
            makeAxe
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.sharingSwitch.click();
            await workspaceSettingsPage.stopSharingDialog.waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('the switcher popover with a shared badge', async ({
            workspaceSettingsPage,
            makeAxe
        }) => {
            await workspaceSettingsPage.goto(WORKSPACE_ID);
            await workspaceSettingsPage.openWorkspaceSwitcher();
            await workspaceSettingsPage
                .switcherSharedBadge('Brand hub')
                .waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
