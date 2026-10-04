import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockSchemaDocument } from '../support/api/schemaBuilder';

/** A retried 5xx settles on a backoff ladder; error states are waited out. */
const SETTLED = { timeout: 20_000 };

/**
 * The content model page (`@orthacms/schema-builder-admin`, ADR-0020): its
 * four states — no access, loading, error, loaded — the rail and the URL, and
 * how a type's fields are laid out under the entry editor's built-in tabs.
 */
test.describe('Content Model', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('is reachable from the primary nav', async ({
        page,
        contentModelPage
    }) => {
        await mockSchemaDocument(page);
        await page.goto('/');
        await contentModelPage.navLink.click();
        await expect(page).toHaveURL(/\/content-model$/);
        await expect(contentModelPage.heading).toBeVisible();
    });

    test.describe('loading', () => {
        test('keeps the real header and announces one skeleton region', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page, { delayMs: 1500 });
            await contentModelPage.goto();

            await expect(contentModelPage.loading).toBeVisible();
            await expect(contentModelPage.loading).toHaveAttribute(
                'aria-busy',
                'true'
            );
            await expect(page.getByRole('status')).toHaveCount(1);
            await expect(contentModelPage.heading).toBeVisible();
            const before = await contentModelPage.heading.boundingBox();

            await expect(contentModelPage.rail).toBeVisible();
            await expect(contentModelPage.loading).toHaveCount(0);
            // The chrome is shared by the skeleton and the page: it must not move.
            expect(await contentModelPage.heading.boundingBox()).toEqual(
                before
            );
        });
    });

    test.describe('states', () => {
        test('without content:read, says so and sends no request', async ({
            page,
            contentModelPage
        }) => {
            await mockSignedIn(page, { permissions: ['workspaces:read'] });
            const calls = await mockSchemaDocument(page);
            await contentModelPage.goto();

            await expect(contentModelPage.noAccessHeading()).toBeVisible();
            await expect(contentModelPage.heading).toBeVisible();
            await expect(contentModelPage.navLink).toHaveCount(0);
            expect(calls.count).toBe(0);
        });

        test('shows an error with a retry, never an empty model', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page, { fails: true });
            await contentModelPage.goto();
            await expect(contentModelPage.errorAlert).toBeVisible(SETTLED);
            await expect(contentModelPage.emptyHeading()).toHaveCount(0);

            await mockSchemaDocument(page);
            await contentModelPage.retryButton.click();
            await expect(
                contentModelPage.typeHeading('Articles')
            ).toBeVisible();
        });

        test('shows the empty state for a model with no types', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page, { types: [] });
            await contentModelPage.goto();
            await expect(contentModelPage.emptyHeading()).toBeVisible();
        });

        test('says why the page is read-only', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page, {
                capabilities: {
                    editable: false,
                    reason: 'production',
                    restart: 'watch'
                }
            });
            await contentModelPage.goto();
            await expect(
                contentModelPage.notice(/runs in production/)
            ).toBeVisible();
        });

        test('on an editable server, explains only why a hand-written type stays read-only', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page, {
                capabilities: { editable: true, restart: 'watch' }
            });
            await contentModelPage.goto('article');
            await expect(
                contentModelPage.notice(/is written by hand in/)
            ).toBeVisible();
            await expect(contentModelPage.notice(/Editing is off/)).toHaveCount(
                0
            );

            await contentModelPage.railLink('Authors').click();
            await expect(contentModelPage.typeHeading('Authors')).toBeVisible();
            await expect(
                contentModelPage.notice(/is written by hand in/)
            ).toHaveCount(0);
        });
    });

    test.describe('the rail', () => {
        test('selects the first type by default and follows the URL', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto();
            await expect(contentModelPage.currentRailLink()).toHaveAttribute(
                'href',
                '/content-model/article'
            );

            await contentModelPage.railLink('Home').click();
            await expect(page).toHaveURL(/\/content-model\/home$/);
            await expect(contentModelPage.typeHeading('Home')).toBeVisible();
            await expect(contentModelPage.currentRailLink()).toHaveAttribute(
                'href',
                '/content-model/home'
            );

            await page.goBack();
            await expect(
                contentModelPage.typeHeading('Articles')
            ).toBeVisible();
        });

        test('falls back to the first type for an unknown name', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('removed_type');
            await expect(
                contentModelPage.typeHeading('Articles')
            ).toBeVisible();
        });
    });

    test.describe('a type', () => {
        test('lays fields out under the built-in tabs, General by rank then groups', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('article');

            await expect(contentModelPage.tab('General')).toBeVisible();
            // Declared body, title, kind; drawn inputs → choices → long text.
            expect(await contentModelPage.fieldNames('General')).toEqual([
                'title',
                'kind',
                'body',
                'slug'
            ]);
            expect(await contentModelPage.fieldNames('Relations')).toEqual([
                'author'
            ]);
            expect(await contentModelPage.fieldNames('Media')).toEqual([
                'cover'
            ]);
        });

        test('draws a group as an accordion that folds', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('article');

            const trigger = contentModelPage.groupTrigger('SEO');
            await expect(trigger).toHaveAttribute('aria-expanded', 'true');
            await expect(
                contentModelPage.tab('General').getByText('starts folded')
            ).toBeVisible();
            await trigger.click();
            await expect(trigger).toHaveAttribute('aria-expanded', 'false');
            expect(await contentModelPage.fieldNames('General')).toEqual([
                'title',
                'kind',
                'body'
            ]);
        });

        test('leaves out a tab with nothing on it', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('home');
            await expect(contentModelPage.tab('General')).toBeVisible();
            await expect(contentModelPage.tab('Relations')).toHaveCount(0);
            await expect(contentModelPage.tab('Media')).toHaveCount(0);
        });

        test('names relation targets and the field an inverse mirrors', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('author');
            await expect(
                contentModelPage
                    .tab('Relations')
                    .getByText('mirrors article.author')
            ).toBeVisible();
        });
    });
});
