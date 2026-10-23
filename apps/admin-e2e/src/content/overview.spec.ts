import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    CONTENT_SCHEMA_SEED,
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries
} from '../support/api/content';
import { mockInsightsApi } from '../support/api/insights';

/**
 * The Content Library's overview — the index pane before a type is picked
 * (`ContentOverview`): the workspace's name, the newest saves across its
 * types, what is saved but not live, and a card per collection and page.
 */
test.describe('Content Library overview', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
    });

    test('is titled with the workspace and links into its records', async ({
        contentLibraryPage,
        page
    }) => {
        await mockInsightsApi(page);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(
            page.getByRole('heading', { level: 1, name: 'Library demo' })
        ).toBeVisible();

        const recent = contentLibraryPage
            .overviewSection('Recently edited')
            .getByRole('link');
        await expect(recent.first()).toBeVisible();
        await expect(recent.first()).toHaveAttribute(
            'href',
            /^\/workspaces\/ws_lib\/content\/[a-z_]+(\/[^/]+)?$/
        );

        await expect(
            contentLibraryPage.overviewTypeCard('Collections', 'Blog posts')
        ).toHaveAttribute('href', '/workspaces/ws_lib/content/blog_post');
        await expect(
            contentLibraryPage.overviewTypeCard('Pages', 'Home')
        ).toHaveAttribute('href', '/workspaces/ws_lib/content/home');
    });

    test('"Not live yet" lists only this workspace’s types', async ({
        contentLibraryPage,
        page
    }) => {
        await mockInsightsApi(page, {
            overrides: {
                'content/unshipped': {
                    types: [
                        {
                            name: 'blog_post',
                            label: 'Blog posts',
                            modified: 3,
                            published: 9
                        },
                        // Not granted to this workspace: no row for it.
                        {
                            name: 'article',
                            label: 'Article',
                            modified: 2,
                            published: 4
                        }
                    ],
                    modified: 5,
                    live: 13,
                    neverPublished: 2
                }
            }
        });
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        const notLive = contentLibraryPage.overviewSection('Not live yet');
        await expect(notLive).toContainText(
            '5 of 13 live records have saved changes'
        );
        await expect(
            notLive.getByRole('link', { name: /Blog posts/ })
        ).toHaveAttribute('href', '/workspaces/ws_lib/content/blog_post');
        await expect(notLive.getByRole('link')).toHaveCount(1);
        await expect(notLive).toContainText(
            '2 drafts have never been published.'
        );
    });

    test('says so when everything saved is live', async ({
        contentLibraryPage,
        page
    }) => {
        await mockInsightsApi(page, {
            overrides: {
                'content/unshipped': {
                    types: [],
                    modified: 0,
                    live: 13,
                    neverPublished: 0
                }
            }
        });
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(
            contentLibraryPage.overviewSection('Not live yet')
        ).toContainText('Everything saved is live.');
    });

    test('every collection gets its figures, however many there are', async ({
        contentLibraryPage,
        page
    }) => {
        // The reads used to stop at twelve types, and every card after the
        // twelfth sat on a skeleton for good.
        const extra = Array.from({ length: 14 }, (_, index) => ({
            name: `extra_${index + 1}`,
            kind: 'collection' as const,
            label: `Extra ${String(index + 1).padStart(2, '0')}`
        }));
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await mockSignedIn(page);
        await mockWorkspaces(page, [
            {
                ...LIBRARY_WORKSPACE,
                content: [
                    ...LIBRARY_WORKSPACE.content,
                    ...extra.map((type) => type.name)
                ]
            }
        ]);
        await mockContentSchema(page, {
            types: [...CONTENT_SCHEMA_SEED, ...extra]
        });
        await mockContentSchemaDetail(page);
        await mockContentEntries(page, {
            entries: Object.fromEntries(extra.map((type) => [type.name, []]))
        });
        await mockInsightsApi(page);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(
            contentLibraryPage.overviewTypeCard('Collections', 'Extra 14')
        ).toContainText('0 records');
        // The total is every type's count, not the first twelve's.
        await expect(
            page.getByRole('heading', { level: 1, name: 'Library demo' })
        ).toBeVisible();
        await expect(page.getByRole('main')).toContainText('92 records');
    });
});
