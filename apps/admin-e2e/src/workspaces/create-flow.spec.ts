import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspacesApi,
    spyWorkspaceCreate
} from '../support/api/workspaces';

/**
 * The redesigned create flow (`@orthacms/workspaces-admin`): Basics → Content
 * → People beside a live preview of the card, landing on a "ready" screen with
 * next steps instead of a toast and a jump back to the list. Driven against
 * the stateful `mockWorkspacesApi`: the seed's four content types, its
 * directory (each a Contributor), and the users plugin's invitation endpoint.
 */
test.describe('Create workspace flow', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
    });

    test.describe('with mail configured', () => {
        test.beforeEach(async ({ page }) => {
            await mockWorkspacesApi(page);
        });

        test('the preview is the card the basics will become', async ({
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            await createWorkspacePage.nameInput.fill('Growth team');
            await createWorkspacePage.descriptionInput.fill(
                'Experiments, landing pages and campaign briefs.'
            );

            // The address is made from the name and checked inline.
            await expect(createWorkspacePage.slugInput).toHaveValue(
                'growth-team'
            );
            await expect(
                createWorkspacePage.slugStatus('Available')
            ).toBeVisible();
            await expect(createWorkspacePage.descriptionCounter()).toHaveText(
                '48 / 2000'
            );

            const preview = createWorkspacePage.preview;
            await expect(preview).toContainText('Growth team');
            await expect(preview).toContainText('Just now');
            await expect(preview).toContainText(
                'Experiments, landing pages and campaign briefs.'
            );
            await expect(preview).toContainText('0 records');
        });

        test('picks content types from one list that says where they are used', async ({
            page,
            createWorkspacePage
        }) => {
            const creates = spyWorkspaceCreate(page);
            await createWorkspacePage.goto();
            await createWorkspacePage.toContentStep('Growth team');

            // Two answers first; "Everything" is the default quick path.
            await expect(createWorkspacePage.everythingTile).toHaveAttribute(
                'aria-checked',
                'true'
            );
            await createWorkspacePage.specificContentTile.click();

            const collections =
                createWorkspacePage.contentSection('Collections');
            await expect(collections).toContainText('0 of 2');
            // 800 in Marketing site + 1,204 in Product docs.
            await expect(collections).toContainText('2,004 records elsewhere');

            await createWorkspacePage.contentCheckbox('Blog posts').click();
            await createWorkspacePage.contentCheckbox('Home').click();
            await expect(collections).toContainText('1 of 2');
            await expect(
                createWorkspacePage.contentSection('Pages')
            ).toContainText('1 of 2');
            await expect(createWorkspacePage.preview).toContainText(
                '2 content types'
            );

            await createWorkspacePage.continueButton.click();
            await createWorkspacePage.createButton.click();

            await expect.poll(() => creates.bodies.length).toBe(1);
            expect(creates.bodies[0].content).toEqual({
                mode: 'specific',
                collections: { mode: 'specific', ids: ['blog_post'] },
                pages: { mode: 'specific', ids: ['home'] }
            });
        });

        test('members and invites land in one list, and the ready screen says where the invite went', async ({
            page,
            createWorkspacePage,
            workspaceReadyPage
        }) => {
            const creates = spyWorkspaceCreate(page);
            await createWorkspacePage.goto();
            await createWorkspacePage.toPeopleStep('Growth team');

            // The creator heads the list as "You".
            await expect(
                createWorkspacePage.person('Admin User')
            ).toContainText('You');

            // A name adds an existing account, with its global role…
            await createWorkspacePage.memberSearch.fill('bar');
            await expect(
                createWorkspacePage.memberOption(/Barbara Liskov/)
            ).toContainText('Contributor');
            await createWorkspacePage.memberOption(/Barbara Liskov/).click();
            await expect(
                createWorkspacePage.person('Barbara Liskov')
            ).toContainText('Contributor');

            // …an address invites someone new, saying what will happen.
            await createWorkspacePage.memberSearch.fill('lena@growth.io');
            await createWorkspacePage
                .memberOption('Invite lena@growth.io by email')
                .click();
            const lena = createWorkspacePage.person('lena@growth.io');
            await expect(lena).toContainText(
                'Gets an invite when the workspace is created'
            );
            await expect(lena).toContainText('Invite');
            await expect(createWorkspacePage.preview).toContainText('3 people');

            await createWorkspacePage.createButton.click();

            await expect(page).toHaveURL(
                /\/workspaces\/ws_growth-team\/ready$/
            );
            await expect(
                workspaceReadyPage.heading('Growth team')
            ).toBeVisible();
            await expect(
                workspaceReadyPage.summary(
                    '4 content types · 2 members · 1 invite sent to lena@growth.io'
                )
            ).toBeVisible();
            await expect(
                workspaceReadyPage.step('Write the first record')
            ).toContainText('Blog posts and Products are ready to use.');
            await expect(
                workspaceReadyPage
                    .step('Write the first record')
                    .getByRole('link', { name: 'New record in Blog posts' })
            ).toHaveAttribute(
                'href',
                '/workspaces/ws_growth-team/content/blog_post/new'
            );
            await expect(
                workspaceReadyPage.step('Invite more people')
            ).toContainText('lena@growth.io gets an email');
            await expect(
                workspaceReadyPage.step('Share its published records')
            ).toBeVisible();

            expect(creates.bodies[0].members).toEqual([
                {
                    id: 'u_barbara',
                    name: 'Barbara Liskov',
                    email: 'barbara@orthacms.dev',
                    invited: false
                },
                {
                    id: 'lena@growth.io',
                    name: 'lena@growth.io',
                    email: 'lena@growth.io',
                    invited: true
                }
            ]);

            // The way in.
            await expect(
                workspaceReadyPage.openButton('Growth team')
            ).toHaveAttribute('href', '/workspaces/ws_growth-team');
        });

        test('"Skip — just me" creates without the people added', async ({
            page,
            createWorkspacePage,
            workspaceReadyPage
        }) => {
            const creates = spyWorkspaceCreate(page);
            await createWorkspacePage.goto();
            await createWorkspacePage.toPeopleStep('Solo space');
            await createWorkspacePage.memberSearch.fill('bar');
            await createWorkspacePage.memberOption(/Barbara Liskov/).click();

            await createWorkspacePage.skipJustMe.click();

            await expect(
                workspaceReadyPage.heading('Solo space')
            ).toBeVisible();
            expect(creates.bodies[0].members).toEqual([]);
            await expect(
                workspaceReadyPage.summary('4 content types · 1 member')
            ).toBeVisible();
        });

        test('Back keeps what was entered', async ({ createWorkspacePage }) => {
            await createWorkspacePage.goto();
            await createWorkspacePage.toContentStep('Growth team');
            await createWorkspacePage.specificContentTile.click();
            await createWorkspacePage.contentCheckbox('Blog posts').click();

            await createWorkspacePage.back.click();
            await expect(createWorkspacePage.nameInput).toHaveValue(
                'Growth team'
            );
            await createWorkspacePage.continueButton.click();
            await expect(
                createWorkspacePage.contentCheckbox('Blog posts')
            ).toHaveAttribute('aria-checked', 'true');
        });

        test('a ready screen for a workspace outside the list says so', async ({
            workspaceReadyPage
        }) => {
            await workspaceReadyPage.goto('ws_nowhere');
            await expect(workspaceReadyPage.missing()).toBeVisible();
            await expect(workspaceReadyPage.backToWorkspaces).toBeVisible();
        });
    });

    test('without mail, the ready screen points to the invite link', async ({
        page,
        createWorkspacePage,
        workspaceReadyPage
    }) => {
        await mockWorkspacesApi(page, undefined, { inviteDelivery: 'link' });
        await createWorkspacePage.goto();
        await createWorkspacePage.toPeopleStep('Growth team');
        await createWorkspacePage.memberSearch.fill('lena@growth.io');
        await createWorkspacePage
            .memberOption('Invite lena@growth.io by email')
            .click();
        await createWorkspacePage.createButton.click();

        await expect(
            workspaceReadyPage.summary(
                /1 invite link ready for lena@growth\.io/
            )
        ).toBeVisible();
        await expect(
            workspaceReadyPage.step('Invite more people')
        ).toContainText('copy the invite link for lena@growth.io from Members');
    });

    test('without users:create the invite waits instead of being sent', async ({
        page,
        createWorkspacePage,
        workspaceReadyPage
    }) => {
        await mockSignedIn(page, {
            permissions: [
                'workspaces:read',
                'workspaces:create',
                'workspaces:update'
            ]
        });
        await mockWorkspacesApi(page);
        const resends: string[] = [];
        page.on('request', (request) => {
            if (/\/invites\/resend$/.test(request.url())) {
                resends.push(request.url());
            }
        });
        await createWorkspacePage.goto();
        await createWorkspacePage.toPeopleStep('Growth team');
        await createWorkspacePage.memberSearch.fill('lena@growth.io');
        await createWorkspacePage
            .memberOption('Invite lena@growth.io by email')
            .click();
        await expect(
            createWorkspacePage.person('lena@growth.io')
        ).toContainText('someone who can invite sends it from Members');
        await createWorkspacePage.createButton.click();

        await expect(
            workspaceReadyPage.summary(/1 invite waiting for lena@growth\.io/)
        ).toBeVisible();
        expect(resends).toEqual([]);
    });
});
