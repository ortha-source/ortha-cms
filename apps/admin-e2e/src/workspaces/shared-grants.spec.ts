import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    WORKSPACES_SEED,
    mockWorkspaceSettingsApi,
    mockWorkspacesApi,
    spyContentGrants,
    spyWorkspaceCreate,
    type SharedSourceSeed,
    type WorkspaceView
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_grants';

/** The shared workspace the settings tab offers types from. */
const TRAVEL: SharedSourceSeed = {
    workspaceId: 'ws_travel',
    workspaceName: 'Travel Library',
    content: [
        { slug: 'product', kind: 'collection' },
        { slug: 'blog_post', kind: 'collection' },
        { slug: 'about', kind: 'single' }
    ]
};

/**
 * Owns Blog posts + Products; already reads Blog posts from the Travel Library,
 * and Products from an archive that has since stopped sharing (inert).
 */
function seed(): WorkspaceView {
    return {
        id: WORKSPACE_ID,
        name: 'Marketing site',
        slug: 'marketing-site',
        description: '',
        color: 'violet',
        status: 'active',
        members: [
            { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@orthacms.dev' }
        ],
        content: ['blog_post', 'product'],
        sharedContent: [
            {
                slug: 'blog_post',
                kind: 'collection',
                sourceWorkspaceId: TRAVEL.workspaceId,
                sourceWorkspaceName: TRAVEL.workspaceName,
                available: true
            },
            {
                slug: 'product',
                kind: 'collection',
                sourceWorkspaceId: 'ws_archive',
                sourceWorkspaceName: 'Old archive',
                available: false
            }
        ]
    };
}

/**
 * **Per-source content grants** on the workspace settings Content tab and in
 * the create wizard (`@orthacms/workspaces-admin`): a grant from a shared
 * workspace is its own row ("{Type} · {Workspace}", Shared badge, Unavailable
 * while inert), added through the same dialog under "From {workspace}" and
 * removed with `?source=` — never taking the own grant with it.
 */
test.describe('Shared content grants — settings', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaceSettingsApi(page, [seed()], {
            sharedSources: { [WORKSPACE_ID]: [TRAVEL] }
        });
    });

    test('lists shared grants beside the own ones, with Shared and Unavailable badges', async ({
        workspaceSettingsPage
    }) => {
        await workspaceSettingsPage.gotoSection(WORKSPACE_ID, 'content');

        const shared = workspaceSettingsPage.grantedRow(
            'Blog posts · Travel Library'
        );
        await expect(shared).toBeVisible();
        await expect(shared.getByText('Shared', { exact: true })).toBeVisible();
        await expect(shared.getByText('Unavailable')).toHaveCount(0);

        const inert = workspaceSettingsPage.grantedRow(
            'Products · Old archive'
        );
        await expect(inert.getByText('Unavailable')).toBeVisible();

        // The own grants are still their own rows.
        await expect(
            workspaceSettingsPage.grantedRow('Blog posts')
        ).toHaveCount(1);
        await expect(workspaceSettingsPage.grantedRow('Products')).toHaveCount(
            1
        );
    });

    test('adds a type from a shared workspace, sending its source', async ({
        page,
        workspaceSettingsPage
    }) => {
        const grants = spyContentGrants(page);
        await workspaceSettingsPage.gotoSection(WORKSPACE_ID, 'content');

        await workspaceSettingsPage.addCollectionsButton.click();
        const group = workspaceSettingsPage.addDialogGroup(
            'From Travel Library'
        );
        await expect(group).toBeVisible();
        // Already granted from this source — not offered again.
        await expect(
            workspaceSettingsPage.sharedContentCheckbox(
                'Blog posts',
                'Travel Library'
            )
        ).toHaveCount(0);

        await workspaceSettingsPage
            .sharedContentCheckbox('Products', 'Travel Library')
            .click();
        await workspaceSettingsPage.addContentSave.click();

        await expect(
            workspaceSettingsPage.grantedRow('Products · Travel Library')
        ).toBeVisible();
        await expect(workspaceSettingsPage.grantedRow('Products')).toHaveCount(
            1
        );
        expect(grants.requests).toEqual([
            {
                method: 'POST',
                url: `/api/workspaces/${WORKSPACE_ID}/content`,
                body: { slug: 'product', sourceWorkspaceId: 'ws_travel' }
            }
        ]);
    });

    test('removes a shared grant with ?source= and keeps the own grant', async ({
        page,
        workspaceSettingsPage
    }) => {
        const grants = spyContentGrants(page);
        await workspaceSettingsPage.gotoSection(WORKSPACE_ID, 'content');

        await workspaceSettingsPage
            .contentRemoveButton('Blog posts · Travel Library')
            .click();
        await workspaceSettingsPage.removeContentConfirm.click();

        await expect(
            workspaceSettingsPage.toast('Blog posts · Travel Library removed.')
        ).toBeVisible();
        await expect(
            workspaceSettingsPage.grantedRow('Blog posts · Travel Library')
        ).toHaveCount(0);
        await expect(
            workspaceSettingsPage.grantedRow('Blog posts')
        ).toHaveCount(1);
        expect(grants.requests).toEqual([
            {
                method: 'DELETE',
                url: `/api/workspaces/${WORKSPACE_ID}/content/blog_post?source=ws_travel`
            }
        ]);
    });

    test('removes an own grant without ?source=', async ({
        page,
        workspaceSettingsPage
    }) => {
        const grants = spyContentGrants(page);
        await workspaceSettingsPage.gotoSection(WORKSPACE_ID, 'content');

        await workspaceSettingsPage.contentRemoveButton('Blog posts').click();
        await expect(workspaceSettingsPage.removeContentConfirm).toBeEnabled();
        await workspaceSettingsPage.removeContentConfirm.click();

        await expect(
            workspaceSettingsPage.toast(/Content type removed/)
        ).toBeVisible();
        await expect(
            workspaceSettingsPage.grantedRow('Blog posts · Travel Library')
        ).toBeVisible();
        expect(grants.requests).toEqual([
            {
                method: 'DELETE',
                url: `/api/workspaces/${WORKSPACE_ID}/content/blog_post`
            }
        ]);
    });

    test('accessibility: the tab with shared rows, and the grouped add dialog', async ({
        workspaceSettingsPage,
        makeAxe
    }) => {
        await workspaceSettingsPage.gotoSection(WORKSPACE_ID, 'content');
        await workspaceSettingsPage
            .grantedRow('Products · Old archive')
            .waitFor();
        await expectNoA11yViolations(makeAxe());

        await workspaceSettingsPage.addPagesButton.click();
        await workspaceSettingsPage
            .addDialogGroup('From Travel Library')
            .waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});

test.describe('Shared content grants — create wizard', () => {
    /** A shared workspace in the creator's list, holding two types. */
    const SHARED_SOURCE: WorkspaceView = {
        ...WORKSPACES_SEED[0],
        id: 'ws_travel',
        name: 'Travel Library',
        slug: 'travel-library',
        isShared: true,
        content: ['product', 'about']
    };

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspacesApi(page, [SHARED_SOURCE, ...WORKSPACES_SEED]);
    });

    test('offers shared types in "Specific content" and sends them with the selection', async ({
        page,
        createWorkspacePage
    }) => {
        const creates = spyWorkspaceCreate(page);
        await createWorkspacePage.goto();
        await createWorkspacePage.nameInput.fill('Guides');
        await createWorkspacePage.continueToMembers.click();
        await createWorkspacePage.continueToContent.click();

        await createWorkspacePage.specificContentTile.click();
        await expect(
            createWorkspacePage.sharedContentGroup('Travel Library')
        ).toBeVisible();
        await createWorkspacePage
            .sharedContentCheckbox('Products', 'Travel Library')
            .click();
        await createWorkspacePage.createButton.click();

        await expect.poll(() => creates.bodies.length).toBe(1);
        expect(creates.bodies[0].content).toEqual({
            mode: 'specific',
            collections: { mode: 'specific', ids: [] },
            pages: { mode: 'specific', ids: [] },
            sharedContent: [{ slug: 'product', sourceWorkspaceId: 'ws_travel' }]
        });
    });

    test('"All content" stays this workspace’s own types', async ({
        page,
        createWorkspacePage
    }) => {
        const creates = spyWorkspaceCreate(page);
        await createWorkspacePage.goto();
        await createWorkspacePage.nameInput.fill('Guides');
        await createWorkspacePage.continueToMembers.click();
        await createWorkspacePage.continueToContent.click();

        await expect(
            createWorkspacePage.sharedContentGroup('Travel Library')
        ).toHaveCount(0);
        await createWorkspacePage.createButton.click();

        await expect.poll(() => creates.bodies.length).toBe(1);
        expect(creates.bodies[0].content).toEqual({ mode: 'all' });
    });

    test('accessibility: the content step with shared types', async ({
        createWorkspacePage,
        makeAxe
    }) => {
        await createWorkspacePage.goto();
        await createWorkspacePage.nameInput.fill('Guides');
        await createWorkspacePage.continueToMembers.click();
        await createWorkspacePage.continueToContent.click();
        await createWorkspacePage.specificContentTile.click();
        await createWorkspacePage
            .sharedContentGroup('Travel Library')
            .waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
