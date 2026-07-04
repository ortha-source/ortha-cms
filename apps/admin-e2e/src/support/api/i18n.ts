import { type Page } from '@playwright/test';
import { type WorkspaceView } from './workspaces';

/**
 * Mock layer for the i18n feature (`@ortha-cms/i18n-admin` + the content
 * library's slots). Self-contained: it stubs the content-schema, records-list,
 * and the four `/api/i18n/**` endpoints for one localized collection
 * (`localized_post`), so a spec only needs `mockSignedIn`, `mockWorkspaces`,
 * and `mockI18n`.
 *
 * The seed models two translation groups:
 * - **G1** — an `en` row (`lp-en-1`) and its `de` sibling (`lp-de-1`).
 * - **G2** — an `en`-only row (`lp-en-2`), missing `de`/`fr`.
 */

/** A workspace granted the localized collection. */
export const I18N_WORKSPACE: WorkspaceView = {
    id: 'ws_i18n',
    name: 'Localization demo',
    slug: 'localization-demo',
    description: 'Workspace used by the i18n e2e suite.',
    color: 'violet',
    status: 'active',
    members: [{ id: 'u_ada', name: 'Ada Lovelace', email: 'ada@ortha.dev' }],
    content: ['localized_post']
};

/** The configured locales (`en` default / `de` / `fr`). */
const LOCALES = [
    { slug: 'en', name: 'English', isDefault: true },
    { slug: 'de', name: 'Deutsch', isDefault: false },
    { slug: 'fr', name: 'Français', isDefault: false }
];

/** The localized collection's full field schema (i18n + a localized title). */
const LOCALIZED_SCHEMA = {
    name: 'localized_post',
    kind: 'collection' as const,
    label: 'Localized posts',
    publishable: true,
    i18n: true,
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            localized: true,
            validation: {},
            admin: { label: 'Title' }
        },
        {
            name: 'category',
            type: 'select',
            required: false,
            validation: {},
            options: ['news', 'guide'],
            admin: { label: 'Category' }
        }
    ]
};

/** One seed row of the localized collection. */
interface LocalizedRow {
    id: string;
    status: 'draft' | 'published';
    locale: string;
    localeGroupId: string;
    createdAt: string;
    updatedAt: string;
    values: Record<string, unknown>;
}

const ISO = '2026-02-01T00:00:00.000Z';

/** The seed rows across the two translation groups. */
const ROWS: LocalizedRow[] = [
    {
        id: 'lp-en-1',
        status: 'published',
        locale: 'en',
        localeGroupId: 'G1',
        createdAt: ISO,
        updatedAt: ISO,
        values: { title: 'Winter boots', category: 'guide' }
    },
    {
        id: 'lp-de-1',
        status: 'draft',
        locale: 'de',
        localeGroupId: 'G1',
        createdAt: ISO,
        updatedAt: ISO,
        values: { title: 'Winterstiefel', category: 'guide' }
    },
    {
        id: 'lp-en-2',
        status: 'draft',
        locale: 'en',
        localeGroupId: 'G2',
        createdAt: ISO,
        updatedAt: ISO,
        values: { title: 'Rain jacket', category: 'news' }
    }
];

/** Rows of one group, keyed by group id. */
function groupRows(groupId: string): LocalizedRow[] {
    return ROWS.filter((row) => row.localeGroupId === groupId);
}

/**
 * Register every route the i18n suite needs on `page`: the schema list + detail,
 * the locale-scoped records list, and the four `/api/i18n/**` endpoints.
 */
export async function mockI18n(page: Page): Promise<void> {
    // GET /api/content-schema — the type catalogue (anchored off the detail route).
    await page.route(/\/api\/content-schema(\?.*)?$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    name: LOCALIZED_SCHEMA.name,
                    kind: LOCALIZED_SCHEMA.kind,
                    label: LOCALIZED_SCHEMA.label,
                    publishable: true,
                    i18n: true
                }
            ])
        });
    });

    // GET /api/content-schema/:name — the full field schema.
    await page.route(/\/api\/content-schema\/([^/?]+)/, async (route) => {
        const name = decodeURIComponent(
            new URL(route.request().url()).pathname.split('/').pop() ?? ''
        );
        await route.fulfill({
            status: name === LOCALIZED_SCHEMA.name ? 200 : 404,
            contentType: 'application/json',
            body: JSON.stringify(
                name === LOCALIZED_SCHEMA.name
                    ? LOCALIZED_SCHEMA
                    : { message: 'Not found' }
            )
        });
    });

    // /api/content/:name — GET is the strict locale-scoped list (default `en`);
    // POST creates a record. A create with a `localeGroupId` is a **sibling**
    // translation (the consolidated endpoint that replaced /translations); the
    // new row echoes the sent values in the target locale as a fresh draft.
    await page.route(/\/api\/content\/([^/?]+)(\?.*)?$/, async (route) => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON() as {
                values: Record<string, unknown>;
                locale?: string;
                localeGroupId?: string;
            };
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: `lp-${body.locale ?? 'en'}-new`,
                    status: 'draft',
                    locale: body.locale ?? 'en',
                    localeGroupId: body.localeGroupId ?? 'G-new',
                    createdAt: ISO,
                    updatedAt: ISO,
                    values: body.values
                })
            });
            return;
        }
        const url = new URL(route.request().url());
        const locale = url.searchParams.get('locale') ?? 'en';
        const items = ROWS.filter((row) => row.locale === locale);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                items,
                total: items.length,
                page: 1,
                pageSize: 10
            })
        });
    });

    // GET /api/content/:name/:id — read one entry (the editor's canonical read).
    // Registered after the list route so this two-segment pattern is matched
    // first for a `/:type/:id` URL (Playwright tries the newest route first).
    await page.route(
        /\/api\/content\/[^/]+\/([^/?]+)(\?.*)?$/,
        async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }
            const segments = new URL(route.request().url()).pathname
                .split('?')[0]
                .split('/');
            const id = segments[segments.length - 1];
            const row = ROWS.find((candidate) => candidate.id === id);
            await route.fulfill({
                status: row ? 200 : 404,
                contentType: 'application/json',
                body: JSON.stringify(row ?? { message: 'Not found' })
            });
        }
    );

    // GET /api/content/:name/:id/relations — the editor's relations read (this
    // type has none, but the editor still fires it when the tab opens).
    await page.route(
        /\/api\/content\/[^/]+\/[^/]+\/relations$/,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ relations: {} })
            });
        }
    );

    // GET /api/i18n/locales — the configured locales.
    await page.route(/\/api\/i18n\/locales$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: LOCALES })
        });
    });

    // POST /api/i18n/content/:type/locale-summary — batched group members.
    await page.route(
        /\/api\/i18n\/content\/[^/]+\/locale-summary$/,
        async (route) => {
            const body = route.request().postDataJSON() as {
                groupIds: string[];
            };
            const groups: Record<
                string,
                { locale: string; entryId: string; status: string }[]
            > = {};
            for (const groupId of body.groupIds) {
                groups[groupId] = groupRows(groupId).map((row) => ({
                    locale: row.locale,
                    entryId: row.id,
                    status: row.status
                }));
            }
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ groups })
            });
        }
    );

    // GET /api/i18n/content/:type/:id/locales — one entry's locale panel.
    await page.route(
        /\/api\/i18n\/content\/[^/]+\/([^/]+)\/locales$/,
        async (route) => {
            const segments = new URL(route.request().url()).pathname.split('/');
            const id = segments[segments.length - 2];
            const row = ROWS.find((candidate) => candidate.id === id);
            const groupId = row?.localeGroupId ?? 'G1';
            const members = groupRows(groupId);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    localeGroupId: groupId,
                    items: LOCALES.map((locale) => {
                        const member = members.find(
                            (candidate) => candidate.locale === locale.slug
                        );
                        return {
                            locale: locale.slug,
                            isDefault: locale.isDefault,
                            entry: member
                                ? {
                                      id: member.id,
                                      status: member.status,
                                      updatedAt: member.updatedAt
                                  }
                                : null
                        };
                    })
                })
            });
        }
    );
    // Sibling creation is handled by the POST branch of the /api/content/:name
    // route above (POST + localeGroupId), so there is no i18n write route.
}
