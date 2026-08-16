import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockContentSchema } from '../support/api/content';
import { mockCopilotApi } from '../support/api/copilot';
import { mockMediaApi, uploadedAssetId } from '../support/api/media';

const WORKSPACE_ID = 'ws_marketing';

const BRIEF = {
    name: 'brief.md',
    mimeType: 'text/markdown',
    body: '# Brief\n\nShip in Q3.'
};
const NOTES = { name: 'notes.txt', mimeType: 'text/plain', body: 'hello' };

/**
 * Attaching files to a turn — the half of the feature that is **only** browser
 * behaviour, and the reason this suite exists at all.
 *
 * The server side (what the model is told, the workspace check, the fence, the
 * transcript round trip) is covered by `server-e2e`'s `copilot-media-files`
 * suite against a real database. Nothing here re-asserts any of it. What only a
 * browser can answer is: does the paperclip stage a file, does a drag highlight
 * once and not flicker, does pasting text still paste text, is send actually
 * blocked while bytes are in flight, and does removing a chip drop it from the
 * turn without deleting the file.
 *
 * **The upload is mocked as the ordinary media route**, because that is what it
 * is: attaching a file is the user uploading to the library on their own
 * session, and the run only names the id afterwards. `spy.runs[0].attachments`
 * is what proves the two halves met.
 */
test.describe('Agents view — attaching files', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('stages a picked file and sends its id with the turn', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF);

        const chip = agentsPage.stagedChips().first();
        await expect(chip).toContainText('brief.md');

        await agentsPage.ask('What does this say?');

        // Ids only — the server resolves the name, kind and size from the row,
        // because the id is the only part it can verify.
        expect(spy.runs[0]).toMatchObject({
            message: 'What does this say?',
            attachments: [{ assetId: uploadedAssetId(1) }]
        });
        expect(spy.runs[0]['attachments']).toEqual([
            { assetId: uploadedAssetId(1) }
        ]);
    });

    test('clears the staged files once the turn is away', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF);
        await expect(agentsPage.stagedChips()).toHaveCount(1);
        await agentsPage.ask('First question');
        await expect(agentsPage.stagedChips()).toHaveCount(0);

        await agentsPage.ask('Second question, no file');

        // The file belongs to the turn it was sent with. Leaving it staged
        // would silently attach it to every following question.
        expect(spy.runs[1]).not.toHaveProperty('attachments');
    });

    test('shows the file on the turn it was sent with', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF);
        await agentsPage.ask('Summarise it');

        // Rendered from what was staged rather than waiting for the server to
        // echo it back: the chip was on screen a moment ago, and having it
        // vanish until the first frame lands reads as a failed send.
        const sent = agentsPage.sentAttachments();
        await expect(sent).toContainText('brief.md');
        await expect(
            sent.getByRole('link', { name: /brief\.md/ })
        ).toHaveAttribute(
            'href',
            `/api/media/assets/${uploadedAssetId(1)}/raw`
        );
    });

    test('redraws the chips on a reopened thread', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        await mockCopilotApi(page);

        await agentsPage.gotoThread(WORKSPACE_ID, 'c_attached');

        // The attachment is its own column on the row, not something recovered
        // by parsing a text block — which is what makes this possible at all.
        await expect(agentsPage.sentAttachments()).toContainText('brief.md');
    });

    test('removing a chip drops it from the turn', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF, NOTES);
        await expect(agentsPage.stagedChips()).toHaveCount(2);

        await agentsPage.removeAttachment('brief.md').click();
        await expect(agentsPage.stagedChips()).toHaveCount(1);
        await agentsPage.ask('And this one?');

        expect(spy.runs[0]['attachments']).toEqual([
            { assetId: uploadedAssetId(2) }
        ]);
    });

    test('blocks send while an upload is still in flight', async ({
        page,
        agentsPage
    }) => {
        // Without a delay the upload resolves before the blocked state can be
        // observed at all — the thing under test would never exist.
        await mockMediaApi(page, { uploadDelayMs: 1500 });
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF);
        await agentsPage.composer().fill('Read this');

        // Sending now would drop the file from the turn silently, and once the
        // message is gone there is no way to tell "attached" from "uploading".
        await expect(agentsPage.sendButton()).toBeDisabled();
        await expect(agentsPage.composerHint()).toContainText(
            'Waiting for uploads'
        );
        await agentsPage.composer().press('Enter');
        expect(spy.runs).toHaveLength(0);

        await expect(agentsPage.sendButton()).toBeEnabled({ timeout: 5000 });
        await agentsPage.composer().press('Enter');
        expect(spy.runs[0]['attachments']).toEqual([
            { assetId: uploadedAssetId(1) }
        ]);
    });

    test('reports a failed upload on the chip and sends without it', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page, { uploadStatus: 413 });
        const spy = await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await agentsPage.attachFiles(BRIEF);

        await expect(agentsPage.stagedChips().first()).toContainText(
            'Upload failed'
        );
        await agentsPage.ask('Never mind the file');

        // A staged file that failed is simply absent — sending a broken
        // reference would fail the whole run over one file.
        expect(spy.runs[0]).not.toHaveProperty('attachments');
    });

    test('refuses more files than one turn may carry, and says so', async ({
        page,
        agentsPage
    }) => {
        await mockMediaApi(page);
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        // Nine at once: the overflow is dropped rather than the batch refused,
        // so someone dropping a folder still gets the first eight.
        await agentsPage.attachFiles(
            ...Array.from({ length: 9 }, (_unused, index) => ({
                name: `f${index}.txt`,
                mimeType: 'text/plain',
                body: 'x'
            }))
        );

        await expect(agentsPage.stagedChips()).toHaveCount(8);
        await expect(agentsPage.composerHint()).toContainText(
            'Only 8 files can be attached'
        );
    });

    test.describe('drag and drop', () => {
        test('highlights once while files are dragged over the box', async ({
            page,
            agentsPage
        }) => {
            await mockMediaApi(page);
            await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();

            await expect(agentsPage.dropOverlay()).toBeHidden();

            await agentsPage.dragFilesOver(BRIEF);

            // Drag events fire per element, so entering a child fires
            // `dragleave` on the parent. The enter/leave counter is what keeps
            // this on instead of flickering across every child crossed.
            await expect(agentsPage.dropOverlay()).toBeVisible();
        });

        test('attaches dropped files', async ({ page, agentsPage }) => {
            await mockMediaApi(page);
            const spy = await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();

            await agentsPage.dropFiles(BRIEF, NOTES);

            await expect(agentsPage.stagedChips()).toHaveCount(2);
            await expect(agentsPage.dropOverlay()).toBeHidden();

            await agentsPage.ask('What are these?');
            expect(spy.runs[0]['attachments']).toHaveLength(2);
        });
    });

    test.describe('paste', () => {
        test('attaches pasted files', async ({ page, agentsPage }) => {
            await mockMediaApi(page);
            await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();

            await agentsPage.pasteFiles(NOTES);

            await expect(agentsPage.stagedChips().first()).toContainText(
                'notes.txt'
            );
        });

        // The regression this guards: intercepting every paste would break
        // pasting text into a chat composer, which is most of what paste is for.
        test('leaves an ordinary text paste alone', async ({
            page,
            agentsPage
        }) => {
            await mockMediaApi(page);
            await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();

            await agentsPage.composer().click();
            await agentsPage.composer().fill('pasted prose');
            await agentsPage.composer().press('Control+a');
            await agentsPage.composer().press('Control+c');
            await agentsPage.composer().fill('');
            await agentsPage.composer().press('Control+v');

            await expect(agentsPage.composer()).toHaveValue('pasted prose');
            await expect(agentsPage.stagedChips()).toHaveCount(0);
        });
    });

    test.describe('accessibility', () => {
        test('names the paperclip and each chip’s remove control', async ({
            page,
            agentsPage
        }) => {
            await mockMediaApi(page);
            await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();

            await expect(agentsPage.attachButton()).toBeVisible();
            await agentsPage.attachFiles(BRIEF);

            // Named for *that* file, not a bare "Remove" — with four chips
            // staged, four identical controls are four coin flips.
            await expect(agentsPage.removeAttachment('brief.md')).toBeVisible();
        });

        test('has no axe violations with files staged', async ({
            page,
            agentsPage,
            makeAxe
        }) => {
            await mockMediaApi(page);
            await mockCopilotApi(page);
            await agentsPage.goto(WORKSPACE_ID);
            await agentsPage.welcomeHeading().waitFor();
            await agentsPage.attachFiles(BRIEF, NOTES);
            await expect(agentsPage.stagedChips()).toHaveCount(2);

            const results = await makeAxe().analyze();
            expect(results.violations).toEqual([]);
        });
    });
});

/**
 * Who is offered the paperclip at all.
 *
 * An attachment is **not** a copilot authority: the composer uploads to the
 * media library on the user's own session, so what gates it is the ordinary
 * `media:create` — which `viewer` does not hold, though every role holds
 * `copilot:use`. Offering the control anyway put a viewer one click from a 403.
 */
test.describe('Agents view — who may attach', () => {
    test.beforeEach(async ({ page }) => {
        await mockWorkspaces(page);
        await mockContentSchema(page);
    });

    test('a viewer is not offered a control whose every upload would 403', async ({
        page,
        agentsPage
    }) => {
        // The viewer grant set: reads, and the copilot, and no `media:create`.
        await mockSignedIn(page, {
            permissions: [
                'workspaces:read',
                'users:read',
                'content:read',
                'media:read',
                'copilot:use'
            ]
        });
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        // The chat itself is theirs — a viewer's copilot is read-only
        // server-side, not absent — and so is the skills picker, which needs
        // nothing beyond `copilot:use`. Only the paperclip is gone.
        await expect(agentsPage.composer()).toBeVisible();
        await expect(agentsPage.attachButton()).toHaveCount(0);
    });

    test('a role holding media:create still gets it', async ({
        page,
        agentsPage
    }) => {
        await mockSignedIn(page);
        await mockCopilotApi(page);
        await agentsPage.goto(WORKSPACE_ID);
        await agentsPage.welcomeHeading().waitFor();

        await expect(agentsPage.attachButton()).toBeVisible();
    });
});
