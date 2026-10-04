import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockSchemaDocument } from '../support/api/schemaBuilder';
import { expectNoA11yViolations } from '../support/a11y';

/** A retried 5xx settles on a backoff ladder; error states are waited out. */
const SETTLED = { timeout: 20_000 };

/**
 * Axe scans (WCAG 2.1 A/AA + best-practice) of the content model page in each
 * of its states, the skeleton included. A regression guard, not a
 * conformance claim.
 */
test.describe('Content model accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('loaded — a type with groups and every tab', async ({
        page,
        contentModelPage,
        makeAxe
    }) => {
        await mockSchemaDocument(page);
        await contentModelPage.goto('article');
        await contentModelPage.tab('Media').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('loaded — editable server, hand-written notice', async ({
        page,
        contentModelPage,
        makeAxe
    }) => {
        await mockSchemaDocument(page, {
            capabilities: { editable: true, restart: 'watch' }
        });
        await contentModelPage.goto('article');
        await contentModelPage.notice(/is written by hand in/).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('loading — the skeleton', async ({
        page,
        contentModelPage,
        makeAxe
    }) => {
        await mockSchemaDocument(page, { delayMs: 5000 });
        await contentModelPage.goto();
        await contentModelPage.loading.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('error', async ({ page, contentModelPage, makeAxe }) => {
        await mockSchemaDocument(page, { fails: true });
        await contentModelPage.goto();
        await contentModelPage.errorAlert.waitFor(SETTLED);
        await expectNoA11yViolations(makeAxe());
    });

    test('empty', async ({ page, contentModelPage, makeAxe }) => {
        await mockSchemaDocument(page, { types: [] });
        await contentModelPage.goto();
        await contentModelPage.emptyHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('no access', async ({ page, contentModelPage, makeAxe }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });
        await mockSchemaDocument(page);
        await contentModelPage.goto();
        await contentModelPage.noAccessHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
