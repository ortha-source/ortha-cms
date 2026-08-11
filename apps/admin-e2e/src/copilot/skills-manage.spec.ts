import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi } from '../support/api/copilot';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_marketing';

/**
 * Authoring skills — the management page inside the Agents view.
 *
 * The server side (the permission, the name collisions, the workspace scoping)
 * is `server-e2e`'s to prove. What only a browser can answer is whether an
 * admin can actually write one, whether a code-defined skill is visibly
 * read-only rather than merely refused on save, and whether the surface exists
 * at all for a role that may not use it.
 */
test.describe('Copilot skills — management', () => {
    test.beforeEach(async ({ page }) => {
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('lists code skills as read-only and the workspace’s own as editable', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await expect(copilotSkillsPage.row('House style')).toContainText(
            'From code'
        );
        // Absent rather than disabled: a disabled control invites a click and
        // then explains nothing. The badge is what says why.
        await expect(copilotSkillsPage.editSkill('House style')).toHaveCount(0);
        await expect(copilotSkillsPage.editSkill('Tone of voice')).toHaveCount(
            1
        );
    });

    test('creates a skill, deriving its identifier from the name', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        const spy = await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.createSkill({
            title: 'Release notes',
            description: 'How we write release notes.',
            instructions: 'Lead with what changed for the reader.'
        });

        await expect(copilotSkillsPage.dialog()).toHaveCount(0);
        expect(spy.skillWrites[0]).toMatchObject({
            method: 'POST',
            body: {
                name: 'release-notes',
                title: 'Release notes',
                description: 'How we write release notes.',
                mode: 'manual',
                enabled: true
            }
        });
        await expect(copilotSkillsPage.row('Release notes')).toBeVisible();
    });

    test('edits an existing skill', async ({ page, copilotSkillsPage }) => {
        await mockSignedIn(page);
        const spy = await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.editSkill('Tone of voice').click();
        await copilotSkillsPage.dialog().waitFor();
        await copilotSkillsPage.field('Name').fill('Tone');
        await copilotSkillsPage.save().click();

        await expect(copilotSkillsPage.dialog()).toHaveCount(0);
        expect(spy.skillWrites[0]).toMatchObject({
            method: 'PATCH',
            id: 'sk_tone',
            body: { title: 'Tone' }
        });
    });

    // The identifier follows the *name* only while creating. Editing must never
    // re-link them: a run names a skill by its identifier, so changing it under
    // a title edit would un-attach the skill from every composer holding it.
    test('does not rewrite an existing skill’s identifier when its name changes', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        const spy = await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.editSkill('Tone of voice').click();
        await copilotSkillsPage.dialog().waitFor();
        await copilotSkillsPage.field('Name').fill('Something else entirely');
        await copilotSkillsPage.save().click();

        expect(spy.skillWrites[0].body['name']).toBe('tone-of-voice');
    });

    test('deletes a skill after confirming', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        const spy = await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.deleteSkill('Tone of voice').click();
        await copilotSkillsPage.confirmDelete().click();

        await expect(copilotSkillsPage.row('Tone of voice')).toHaveCount(0);
        expect(spy.skillWrites[0]).toMatchObject({
            method: 'DELETE',
            id: 'sk_tone'
        });
    });

    // The two refusals a person actually hits are both name collisions, and the
    // server's own message says which source holds the name — which is the
    // whole of what they need in order to fix it.
    test('shows the server’s reason for refusing a save', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        await mockCopilotApi(page, {
            skillWriteStatus: 409,
            skillWriteMessage:
                '"release-notes" is the name of a skill defined in this deployment’s configuration.'
        });
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.createSkill({
            title: 'Release notes',
            description: 'How we write release notes.',
            instructions: 'Lead with what changed.'
        });

        await expect(copilotSkillsPage.formError()).toContainText(
            'defined in this deployment'
        );
        // The dialog stays open, holding what the person typed — closing it
        // would throw away the work along with the explanation.
        await expect(copilotSkillsPage.dialog()).toBeVisible();
    });

    // Submitting is what surfaces the reason, rather than a greyed-out Save
    // that refuses without saying why.
    test('reports a missing field on submit rather than disabling Save', async ({
        page,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        const spy = await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);

        await copilotSkillsPage.newSkill().click();
        await copilotSkillsPage.dialog().waitFor();
        await expect(copilotSkillsPage.save()).toBeEnabled();

        await copilotSkillsPage.save().click();

        await expect(copilotSkillsPage.dialog()).toBeVisible();
        expect(spy.skillWrites).toHaveLength(0);
    });

    test('a role without the permission gets no page and no rail link', async ({
        page,
        agentsPage,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'content:read', 'copilot:use']
        });
        await mockCopilotApi(page);

        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();
        await expect(agentsPage.manageSkillsLink()).toHaveCount(0);

        await copilotSkillsPage.goto(WORKSPACE_ID);
        await expect(copilotSkillsPage.forbidden()).toBeVisible();
    });

    test('the rail links an admin to the page', async ({
        page,
        agentsPage,
        copilotSkillsPage
    }) => {
        await mockSignedIn(page);
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);

        await agentsPage.manageSkillsLink().click();

        await expect(copilotSkillsPage.heading()).toBeVisible();
    });

    test('has no accessibility violations, listed or in the form', async ({
        page,
        copilotSkillsPage,
        makeAxe
    }) => {
        await mockSignedIn(page);
        await mockCopilotApi(page);
        await copilotSkillsPage.goto(WORKSPACE_ID);
        await copilotSkillsPage.table().waitFor();
        await expectNoA11yViolations(makeAxe());

        await copilotSkillsPage.newSkill().click();
        await copilotSkillsPage.dialog().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
