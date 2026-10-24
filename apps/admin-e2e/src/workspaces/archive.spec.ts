import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspaceSettingsApi,
    WORKSPACES_SEED
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Archiving from the workspace cards (`@orthacms/workspaces-admin`): the ⋯
 * menu opens a confirmation that counts what stays and who notices before
 * its button, an archived card stays findable under Archived, and Restore
 * brings it back. Driven against the stateful settings mock, which also
 * answers `GET /workspaces/:id/archive-impact`.
 */
test.describe('Archiving a workspace from its card', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaceSettingsApi(page, WORKSPACES_SEED, {
            linkedWorkspaces: { ws_support: 2 }
        });
    });

    test('says what it touches, then archives', async ({ workspacesPage }) => {
        await workspacesPage.goto();

        await workspacesPage.cardMenu('Support hub').click();
        await workspacesPage.menuItem('Archive…').click();

        const dialog = workspacesPage.archiveDialog();
        await expect(
            dialog.getByRole('heading', { name: 'Archive Support hub?' })
        ).toBeVisible();
        await expect(dialog).toContainText(
            'It leaves the sidebar and the list. Nothing is deleted:'
        );
        await expect(dialog).toContainText('318 records stay where they are');
        await expect(dialog).toContainText('2 members keep their accounts');
        await expect(dialog).toContainText(
            '2 workspaces linking its records see them as unavailable'
        );
        await expect(dialog).toContainText(
            'Restore it any time from Workspaces → Archived.'
        );

        await workspacesPage.archiveConfirm().click();

        await expect(
            workspacesPage.toast('Support hub archived.')
        ).toBeVisible();
        await expect(workspacesPage.card('Support hub')).toBeHidden();
        await expect(workspacesPage.count()).toHaveText(
            '3 workspaces shown of 6.'
        );

        await workspacesPage.filterByStatus('Archived');
        const archived = workspacesPage.card('Support hub');
        await expect(
            archived.getByText('Archived', { exact: true })
        ).toBeVisible();
        await expect(archived.getByText(/^Archived /)).toBeVisible();
    });

    test('Cancel archives nothing', async ({ page, workspacesPage }) => {
        const archives: string[] = [];
        page.on('request', (request) => {
            if (
                request.method() === 'POST' &&
                /\/archive$/.test(request.url())
            ) {
                archives.push(request.url());
            }
        });
        await workspacesPage.goto();
        await workspacesPage.cardMenu('Support hub').click();
        await workspacesPage.menuItem('Archive…').click();
        await workspacesPage
            .archiveDialog()
            .getByRole('button', { name: 'Cancel' })
            .click();

        await expect(workspacesPage.archiveDialog()).toBeHidden();
        await expect(workspacesPage.card('Support hub')).toBeVisible();
        expect(archives).toEqual([]);
    });

    test('an archived card comes back with Restore', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();
        await workspacesPage.filterByStatus('Archived');

        const card = workspacesPage.card('Research archive');
        await expect(card.getByText(/^Archived /)).toBeVisible();
        await workspacesPage.restoreButton('Research archive').click();

        await expect(
            workspacesPage.toast('Research archive restored.')
        ).toBeVisible();
        await workspacesPage.filterByStatus('Active');
        await expect(workspacesPage.card('Research archive')).toBeVisible();
    });

    test('accessibility: the confirmation with its counts', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.cardMenu('Support hub').click();
        await workspacesPage.menuItem('Archive…').click();
        await workspacesPage
            .archiveDialog()
            .getByText('318 records stay where they are')
            .waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('the menu is keyboard-operable end to end', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.cardMenu('Support hub').focus();
        await page.keyboard.press('Enter');
        await expect(workspacesPage.menuItem('Open')).toBeVisible();
        await workspacesPage.menuItem('Archive…').focus();
        await page.keyboard.press('Enter');

        await expect(workspacesPage.archiveDialog()).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(workspacesPage.archiveDialog()).toBeHidden();
        // Focus comes back to the trigger that opened it.
        await expect(workspacesPage.cardMenu('Support hub')).toBeFocused();
    });
});

test.describe('Archiving without workspaces:update', () => {
    test('the card menu offers no Archive and archived cards no Restore', async ({
        page,
        workspacesPage
    }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });
        await mockWorkspaceSettingsApi(page, WORKSPACES_SEED);
        await workspacesPage.goto();

        await workspacesPage.cardMenu('Support hub').click();
        await expect(workspacesPage.menuItem('Open')).toBeVisible();
        await expect(workspacesPage.menuItem('Archive…')).toHaveCount(0);
        await page.keyboard.press('Escape');

        await workspacesPage.filterByStatus('Archived');
        await expect(
            workspacesPage.restoreButton('Research archive')
        ).toHaveCount(0);
    });
});
