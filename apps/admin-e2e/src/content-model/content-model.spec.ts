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
            // Retried: the loaded page mounts its own chrome, so a measure that
            // lands on the swap reads a detached heading and gets `null`.
            let before: Awaited<
                ReturnType<typeof contentModelPage.heading.boundingBox>
            > = null;
            await expect(async () => {
                before = await contentModelPage.heading.boundingBox();
                expect(before).not.toBeNull();
            }).toPass();

            await expect(contentModelPage.rail).toBeVisible();
            await expect(contentModelPage.loading).toHaveCount(0);
            // The skeleton draws its `<h1>` where the type's will be: it must
            // not move (it names the type now, so only its width may change).
            // (Assigned inside the retried block, which TypeScript cannot see.)
            const start = before as unknown as { x: number; y: number };
            const after = await contentModelPage.heading.boundingBox();
            expect({ x: after?.x, y: after?.y }).toEqual({
                x: start.x,
                y: start.y
            });
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
        test('lays fields out as the one form does: by rank, relations and media included, then groups', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('article');

            await expect(contentModelPage.fields()).toBeVisible();
            // Declared body, title, kind; drawn inputs → choices → long text,
            // then the relation and the media field (ADR-0022), then the
            // group's field.
            expect(await contentModelPage.fieldNames()).toEqual([
                'title',
                'kind',
                'body',
                'author',
                'cover',
                'slug'
            ]);
            await expect(contentModelPage.block('Relations')).toHaveCount(0);
            await expect(contentModelPage.block('Media')).toHaveCount(0);
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
                contentModelPage.fields().getByText('starts folded')
            ).toBeVisible();
            await trigger.click();
            await expect(trigger).toHaveAttribute('aria-expanded', 'false');
            expect(await contentModelPage.fieldNames()).toEqual([
                'title',
                'kind',
                'body',
                'author',
                'cover'
            ]);
        });

        test('draws no Relations or Media block — they are fields of the form', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('home');
            await expect(contentModelPage.fields()).toBeVisible();
            await expect(contentModelPage.block('Relations')).toHaveCount(0);
            await expect(contentModelPage.block('Media')).toHaveCount(0);
        });

        test('names relation targets and the field an inverse mirrors', async ({
            page,
            contentModelPage
        }) => {
            await mockSchemaDocument(page);
            await contentModelPage.goto('author');
            await expect(
                contentModelPage.fields().getByText('mirrors article.author')
            ).toBeVisible();
        });
    });
});
