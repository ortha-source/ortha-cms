import { test, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { LIBRARY_WORKSPACE, mockContentSchema } from '../support/api/content';
import { mockProtectionRules } from '../support/api/protection';

const WS = LIBRARY_WORKSPACE.id;
const SETTINGS = `/workspaces/${WS}/settings/protection`;

/**
 * The seed summaries carry no `publishable` flag, while the real
 * `GET /api/content-schema` does — and the tab lists only publishable types,
 * because protection guards `draft → published`. Overridden here rather than in
 * the shared fixture so no other suite's behaviour moves.
 */
const TYPES = [
    {
        name: 'blog_post',
        kind: 'collection' as const,
        label: 'Blog posts',
        publishable: true
    },
    {
        name: 'product',
        kind: 'collection' as const,
        label: 'Products',
        publishable: true
    },
    {
        name: 'settings_page',
        kind: 'single' as const,
        label: 'Site config',
        publishable: false
    }
];

/**
 * The workspace settings **Protection** tab — the surface that makes a rule
 * exist at all. Until this shipped a rule could only be written with SQL.
 *
 * The server side is covered by `server-e2e`; what only a browser can answer is
 * whether an administrator can tell what a rule will do before saving it — and
 * in particular whether the workspace that would lock itself out is told so at
 * the moment it happens rather than a week later.
 */
test.describe('Workspace settings, Protection tab', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page, { types: TYPES });
    });

    test('lists the granted publishable types, protected or not', async ({
        page
    }) => {
        await mockProtectionRules(page, [
            { slug: 'blog_post', enabled: true, requiredApprovals: 2 }
        ]);
        await page.goto(SETTINGS);

        await expect(page.getByText('Publication protection')).toBeVisible();
        // The protected one says how many, the granted-but-unprotected one says
        // so in words — a badge tone alone would be colour carrying meaning.
        await expect(page.getByText('2 approvals')).toBeVisible();
        await expect(page.getByText('Not protected')).toBeVisible();
        // Non-publishable: no draft→published step, so no rule to offer.
        await expect(
            page.getByText('Site config', { exact: true })
        ).toHaveCount(0);
    });

    test('is reachable from the settings tab strip', async ({ page }) => {
        await mockProtectionRules(page, []);
        await page.goto(`/workspaces/${WS}/settings/general`);

        await page.getByRole('link', { name: 'Protection' }).click();
        await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`));
    });

    /**
     * ADR-0017 accepts that a one-person workspace with four eyes required
     * blocks itself, and says the interface must name it **when the rule is
     * switched on**. This is that moment, in a real browser.
     */
    test('warns the moment a lone member switches the rule on', async ({
        page
    }) => {
        await mockWorkspaces(page, [
            {
                ...LIBRARY_WORKSPACE,
                members: LIBRARY_WORKSPACE.members.slice(0, 1)
            }
        ]);
        await mockProtectionRules(page, []);
        await page.goto(SETTINGS);

        await page
            .getByRole('button', {
                name: 'Configure protection for Blog posts'
            })
            .click();

        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText(/Nobody could publish/)).toHaveCount(0);

        await dialog
            .getByRole('switch', { name: 'Require review before publishing' })
            .click();

        // In a live region, so it is spoken rather than only drawn.
        await expect(
            dialog.getByRole('status').getByText(/Nobody could publish/)
        ).toBeVisible();
    });

    /**
     * `PUT` replaces rather than patches, so a body missing a field resets it.
     * Asserted on the captured request: a partial body looks identical on
     * screen and only differs in what the server then stores.
     */
    test('submits all six fields, and the count that was typed', async ({
        page
    }) => {
        const writes = await mockProtectionRules(page, []);
        await page.goto(SETTINGS);

        await page
            .getByRole('button', {
                name: 'Configure protection for Blog posts'
            })
            .click();
        const dialog = page.getByRole('dialog');
        await dialog
            .getByRole('switch', { name: 'Require review before publishing' })
            .click();
        await dialog
            .getByRole('spinbutton', { name: 'Approvals needed' })
            .fill('3');
        await dialog.getByRole('button', { name: 'Save' }).click();

        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].path).toBe('collection/blog_post');
        expect(Object.keys(writes[0].body).sort()).toEqual([
            'adminBypass',
            'allowTokenPublish',
            'countStaleApprovals',
            'enabled',
            'requireOtherPerson',
            'requiredApprovals'
        ]);
        expect(writes[0].body.requiredApprovals).toBe(3);
        expect(writes[0].body.enabled).toBe(true);
    });

    /**
     * A failed read is not an empty one. "Nothing is protected" is a claim
     * about the workspace, and making it when the truth is "we could not ask"
     * is how somebody concludes a rule they set has vanished.
     */
    test('says the rules could not be loaded, not that none exist', async ({
        page
    }) => {
        await mockProtectionRules(page, [], { status: 500 });
        await page.goto(SETTINGS);

        // A 5xx is retried three times with backoff before `isError`, so the
        // error state is seconds away — see the admin-e2e gotchas.
        await expect(
            page.getByText('Protection rules could not be loaded')
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Not protected')).toHaveCount(0);
    });

    test('hides the tab from somebody without protection:manage', async ({
        page
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'content:read']
        });
        await mockProtectionRules(page, []);
        await page.goto(`/workspaces/${WS}/settings/general`);

        await expect(
            page.getByRole('link', { name: 'Protection' })
        ).toHaveCount(0);
    });

    test('is operable from the keyboard', async ({ page }) => {
        await mockProtectionRules(page, []);
        await page.goto(SETTINGS);

        const configure = page.getByRole('button', {
            name: 'Configure protection for Blog posts'
        });
        await configure.focus();
        await page.keyboard.press('Enter');

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Escape closes and puts focus back where it came from, so a keyboard
        // user is not left at the top of the page.
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(configure).toBeFocused();
    });

    test('has no accessibility violations, list or editor', async ({
        page,
        makeAxe
    }) => {
        await mockProtectionRules(page, [
            { slug: 'blog_post', enabled: true, requiredApprovals: 2 }
        ]);
        await page.goto(SETTINGS);
        await expect(page.getByText('Publication protection')).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await page
            .getByRole('button', {
                name: 'Configure protection for Blog posts'
            })
            .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
