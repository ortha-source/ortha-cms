import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi } from '../support/api/copilot';
import { expectNoA11yViolations } from '../support/a11y';

const WORKSPACE_ID = 'ws_marketing';

/**
 * Skills in the chat surface — the half of the feature only a browser can
 * answer for.
 *
 * The server side (what reaches the model, the workspace check, the collision
 * rules, the transcript round trip) is covered by `server-e2e`'s
 * `copilot-skills` suite against a real database, and nothing here re-asserts
 * any of it. What only a browser can say is: does the picker stage a skill,
 * does the run body carry **names** and nothing else, does an always-on skill
 * show up without anyone choosing it, does the selection survive leaving the
 * page, and can a person see afterwards what a turn ran under.
 */
test.describe('Agents view — skills', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('stages a skill and sends its name with the turn', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');

        await expect(agentsPage.stagedSkillChips()).toHaveText([
            // The always-on one first, matching the order the server puts them
            // in, then what the person picked.
            /House style/,
            /Tone of voice/
        ]);

        await agentsPage.ask('Rewrite the intro');

        // **Names only.** A body in the request would be a client writing its
        // own system prompt; the server resolves everything else.
        expect(spy.runs[0]['skills']).toEqual([{ name: 'tone-of-voice' }]);
    });

    // An always-on skill is workspace configuration. A client that could omit
    // it from the request could switch it off by not asking for it, so it is
    // never in the body — and it still shows on the chip row, because the
    // person is entitled to know what their answer was written under.
    test('shows an always-on skill without sending it', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.stagedSkillChips()).toHaveText([/House style/]);

        await agentsPage.ask('Anything at all');

        expect(spy.runs[0]['skills']).toBeUndefined();
    });

    test('the count is in the button’s accessible name', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.skillsButton()).toHaveAccessibleName('Skills');

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');

        await expect(agentsPage.skillsButton()).toHaveAccessibleName('1 skill');
    });

    test('drops a staged skill from the next turn', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');
        await agentsPage.removeSkill('Tone of voice').click();

        await agentsPage.ask('Never mind');

        expect(spy.runs[0]['skills']).toBeUndefined();
    });

    // A file belongs to the message it was attached to; a skill is the mode the
    // chat is working in. Re-picking it before every message is the friction
    // that makes people stop using the feature.
    test('keeps a staged skill after sending, unlike a file', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');

        await agentsPage.ask('First question');
        await expect(agentsPage.stagedSkillChips()).toHaveText([
            /House style/,
            /Tone of voice/
        ]);

        await agentsPage.ask('Second question');
        expect(spy.runs[1]['skills']).toEqual([{ name: 'tone-of-voice' }]);
    });

    // The bug the model picker already had, in the shape it would take here:
    // held in a component's `useState` the selection is lost by leaving the
    // page, and the next turn silently runs without the instructions the person
    // set up.
    test('the selection survives a trip through the CMS', async ({
        page,
        agentsPage
    }) => {
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');

        await agentsPage.viewTab('CMS').click();
        await agentsPage.viewTab('Agents').click();
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.ask('Still on?');
        expect(spy.runs[0]['skills']).toEqual([{ name: 'tone-of-voice' }]);
    });

    test('a reopened thread redraws the skills its turn ran under', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page);
        await agentsPage.gotoThread(WORKSPACE_ID, 'c_summary');

        await expect(agentsPage.sentSkills().getByRole('listitem')).toHaveText([
            /House style/,
            /Tone of voice/
        ]);
    });

    // A workspace that has never authored one should not carry the furniture
    // for the feature.
    test('renders no skills control when the workspace has none', async ({
        page,
        agentsPage
    }) => {
        await mockCopilotApi(page, { skills: [] });
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.skillsButton()).toHaveCount(0);
        await expect(agentsPage.stagedSkills()).toHaveCount(0);
    });

    test('has no accessibility violations with skills staged', async ({
        page,
        agentsPage,
        makeAxe
    }) => {
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.openSkills();
        await agentsPage.skillOption('Tone of voice').click();
        await page.keyboard.press('Escape');

        await expect(agentsPage.stagedSkillChips()).toHaveCount(2);
        await expectNoA11yViolations(makeAxe());
    });
});
