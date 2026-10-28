import { test as base, expect } from '../support/fixtures';
import { expectNoA11yViolations } from '../support/a11y';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { LIBRARY_WORKSPACE, mockContentSchema } from '../support/api/content';
import {
    mockProtectionRules,
    mockReviewQueue
} from '../support/api/protection';
import { PublishingSettingsPage } from '../support/pages/PublishingSettingsPage';

/**
 * Registered here rather than in the shared fixtures, so this suite's page
 * object is the only file it adds to the harness.
 */
const test = base.extend<{ publishing: PublishingSettingsPage }>({
    publishing: async ({ page }, use) => {
        await use(new PublishingSettingsPage(page));
    }
});

const WS = LIBRARY_WORKSPACE.id;
const RULES = `/workspaces/${WS}/reviews?tab=rules`;
const OLD_SETTINGS = `/workspaces/${WS}/settings/protection`;

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
 * The Reviews page's **Rules** tab (formerly workspace settings ›
 * Publishing) — the surface that makes a
 * rule exist at all. Until this shipped a rule could only be written with SQL.
 *
 * The server side is covered by `server-e2e`; what only a browser can answer is
 * whether an administrator can tell what a rule will do before saving it — the
 * switches in plain words and the sentence that reads the rule back — and
 * whether the workspace that would lock itself out is told so at the moment it
 * happens rather than a week later.
 */
test.describe('Reviews, Rules', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page, { types: TYPES });
        // The tabs render once the queue has answered.
        await mockReviewQueue(page, []);
    });

    test('lists the granted publishable types, protected or not', async ({
        page,
        publishing
    }) => {
        await mockProtectionRules(page, [
            { slug: 'blog_post', enabled: true, requiredApprovals: 2 }
        ]);
        await publishing.goto(WS);

        await expect(publishing.heading).toBeVisible();
        // The protected one says how many and what it lets through, the
        // granted-but-unprotected one says so in words — a badge tone alone
        // would be colour carrying meaning.
        await expect(
            publishing
                .row('Blog posts')
                .getByText('2 approvals · admins may bypass')
        ).toBeVisible();
        await expect(
            publishing.row('Blog posts').getByText('Protected', { exact: true })
        ).toBeVisible();
        await expect(
            publishing.row('Products').getByText('Not protected')
        ).toBeVisible();
        // Non-publishable: no draft→published step, so no rule to offer.
        await expect(
            page.getByText('Site config', { exact: true })
        ).toHaveCount(0);
    });

    test('is a tab on the Reviews page', async ({ page, publishing }) => {
        await mockProtectionRules(page, []);
        await page.goto(`/workspaces/${WS}/reviews`);

        await publishing.tab().click();
        await expect(page).toHaveURL(/\/reviews\?tab=rules$/);
        await expect(publishing.heading).toBeVisible();
    });

    // The rules moved off the settings page; a bookmark follows them.
    test('sends the old settings address to the Rules tab', async ({
        page,
        publishing
    }) => {
        await mockProtectionRules(page, []);
        await page.goto(OLD_SETTINGS);

        await expect(page).toHaveURL(/\/reviews\?tab=rules$/);
        await expect(publishing.heading).toBeVisible();
    });

    /**
     * ADR-0017 accepts that a one-person workspace with four eyes required
     * blocks itself, and says the interface must name it **when the rule is
     * switched on**. This is that moment, in a real browser.
     */
    test('warns the moment a lone member switches the rule on', async ({
        page,
        publishing
    }) => {
        await mockWorkspaces(page, [
            {
                ...LIBRARY_WORKSPACE,
                members: LIBRARY_WORKSPACE.members.slice(0, 1)
            }
        ]);
        await mockProtectionRules(page, []);
        await publishing.goto(WS);

        await publishing.configure('Blog posts').click();
        await expect(publishing.status).not.toContainText(
            /Nobody could publish/
        );

        await publishing.switch('Require review before publishing').click();

        // In a live region, so it is spoken rather than only drawn.
        await expect(publishing.status).toContainText(/Nobody could publish/);
    });

    /**
     * The rule read back as one sentence — the point of the redesign: what the
     * switches do together, which no single switch says.
     */
    test('reads the rule back in one sentence as it is edited', async ({
        page,
        publishing
    }) => {
        await mockProtectionRules(page, []);
        await publishing.goto(WS);
        await publishing.configure('Blog posts').click();

        await expect(publishing.inShort).toHaveText(
            'In short: a record in Blog posts publishes without review.'
        );

        await publishing.switch('Require review before publishing').click();
        await publishing.approvalsOption('2').click();
        await expect(publishing.inShort).toHaveText(
            'In short: a record in Blog posts needs 2 approvals from people other than its author; admins can override.'
        );

        await publishing.switch('Admins may publish without review').click();
        await publishing.switch('Keep approvals across new saves').click();
        await expect(publishing.inShort).toHaveText(
            'In short: a record in Blog posts needs 2 approvals from people other than its author; approvals stay after a new save.'
        );
    });

    /**
     * `PUT` replaces rather than patches, so a body missing a field resets it.
     * Asserted on the captured request: a partial body looks identical on
     * screen and only differs in what the server then stores.
     */
    test('submits all six fields, and the count that was picked', async ({
        page,
        publishing
    }) => {
        const writes = await mockProtectionRules(page, []);
        await publishing.goto(WS);

        await publishing.configure('Blog posts').click();
        await publishing.switch('Require review before publishing').click();
        await publishing.approvalsOption('3').click();
        await publishing.save.click();

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

    test('takes a count beyond the presets through Other…', async ({
        page,
        publishing
    }) => {
        const writes = await mockProtectionRules(page, []);
        await publishing.goto(WS);

        await publishing.configure('Blog posts').click();
        await publishing.switch('Require review before publishing').click();
        await expect(publishing.otherCount).toHaveCount(0);
        await publishing.approvalsOption('Other…').click();
        await publishing.otherCount.fill('5');
        await publishing.save.click();

        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].body.requiredApprovals).toBe(5);
    });

    /**
     * A failed read is not an empty one. "Nothing is protected" is a claim
     * about the workspace, and making it when the truth is "we could not ask"
     * is how somebody concludes a rule they set has vanished.
     */
    test('says the rules could not be loaded, not that none exist', async ({
        page,
        publishing
    }) => {
        await mockProtectionRules(page, [], { status: 500 });
        await publishing.goto(WS);

        // A 5xx is retried three times with backoff before `isError`, so the
        // error state is seconds away — see the admin-e2e gotchas.
        await expect(
            page.getByText('Protection rules could not be loaded')
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('Not protected')).toHaveCount(0);
    });

    test('hides the tab from somebody without protection:manage', async ({
        page,
        publishing
    }) => {
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'content:read']
        });
        await mockProtectionRules(page, []);
        await page.goto(RULES);

        // A link to the tab lands on the queue instead of a tab that is not
        // there.
        await expect(
            page.getByRole('heading', { name: 'Reviews', level: 1 })
        ).toBeVisible();
        await expect(publishing.tab()).toHaveCount(0);
        await expect(publishing.heading).toHaveCount(0);
    });

    test('is operable from the keyboard', async ({ page, publishing }) => {
        await mockProtectionRules(page, []);
        await publishing.goto(WS);

        const configure = publishing.configure('Blog posts');
        await configure.focus();
        await page.keyboard.press('Enter');
        await expect(publishing.dialog).toBeVisible();

        // The switches toggle from the keyboard, as switches do.
        const enabled = publishing.switch('Require review before publishing');
        await enabled.focus();
        await page.keyboard.press('Space');
        await expect(enabled).toHaveAttribute('aria-checked', 'true');

        // Escape closes and puts focus back where it came from, so a keyboard
        // user is not left at the top of the page.
        await page.keyboard.press('Escape');
        await expect(publishing.dialog).toHaveCount(0);
        await expect(configure).toBeFocused();
    });

    test('has no accessibility violations, list or editor', async ({
        page,
        publishing,
        makeAxe
    }) => {
        await mockProtectionRules(page, [
            { slug: 'blog_post', enabled: true, requiredApprovals: 2 }
        ]);
        await publishing.goto(WS);
        await expect(publishing.heading).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await publishing.configure('Blog posts').click();
        await expect(publishing.dialog).toBeVisible();
        await expect(publishing.removeRule).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
