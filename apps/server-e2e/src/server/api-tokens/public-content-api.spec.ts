import request from 'supertest';
import { ApiTokenService } from '@ortha-cms/identity-server';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedArticles,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'public-api-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** The item shape the list envelope returns (only the asserted bits). */
interface EntryItem {
    id: string;
    values: Record<string, unknown>;
}

/**
 * `GET /api/v1/content/...` — the external, bearer-token-authenticated content
 * API. Covers the token→workspace scoping (a token reads only its own
 * workspace), the flat 401 for missing/invalid/revoked/expired tokens, and that
 * a valid token reaches the same generic list/get pipeline the admin uses.
 */
describe('Public content API (GET /api/v1/content)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;
    let otherWorkspaceId: string;

    /** Mints a token for `workspaceId` and returns its raw secret. */
    async function mintToken(
        scope: 'read' | 'full',
        workspace: string = workspaceId,
        expiresAt?: Date | null
    ): Promise<{ id: string; secret: string }> {
        const { token, secret } = await harness.app
            .get(ApiTokenService)
            .mint({
                name: `${scope} token`,
                workspaceId: workspace,
                scope,
                expiresAt,
                createdBy: admin.id
            });
        return { id: token.id, secret };
    }

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        otherWorkspaceId = (
            await seedWorkspace({ name: 'WS B', slug: 'ws-b' })
        ).id;
        await seedMembership(admin.id, workspaceId);
        await seedArticles(
            [
                { text: 'Alpha', select: 'article', status: 'published' },
                { text: 'Bravo', select: 'tutorial', status: 'draft' }
            ],
            workspaceId
        );
        await seedArticles(
            [{ text: 'Foreign', select: 'article', status: 'published' }],
            otherWorkspaceId
        );
    });

    describe('authentication', () => {
        it('401s without an Authorization header', async () => {
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .expect(401);
        });

        it('401s on a malformed / unknown bearer token', async () => {
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', 'Bearer not-a-real-token')
                .expect(401);
        });

        it('401s on a revoked token', async () => {
            const { id, secret } = await mintToken('read');
            await harness.app.get(ApiTokenService).revoke(id);
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(401);
        });

        it('401s on an expired token', async () => {
            const { secret } = await mintToken(
                'read',
                workspaceId,
                new Date(Date.now() - 60_000)
            );
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(401);
        });
    });

    describe('reads', () => {
        it('lists the token workspace’s entries with a read token', async () => {
            const { secret } = await mintToken('read');
            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(2);
            const texts = (res.body.items as EntryItem[])
                .map((item) => item.values.text)
                .sort();
            expect(texts).toEqual(['Alpha', 'Bravo']);
        });

        it('a full-access token can also read', async () => {
            const { secret } = await mintToken('full');
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
        });

        it('never returns another workspace’s entries', async () => {
            const { secret } = await mintToken('read');
            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            const texts = (res.body.items as EntryItem[]).map(
                (item) => item.values.text
            );
            expect(texts).not.toContain('Foreign');
        });

        it('honours ?filter= over the workspace scope', async () => {
            const { secret } = await mintToken('read');
            const filter = JSON.stringify({
                field: 'select',
                op: 'eq',
                value: 'article'
            });
            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ filter })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(res.body.total).toBe(1);
            expect((res.body.items as EntryItem[])[0].values.text).toBe(
                'Alpha'
            );
        });

        it('404s an unknown content type', async () => {
            const { secret } = await mintToken('read');
            await request(harness.server)
                .get('/api/v1/content/nope')
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('gets one entry by id, and 404s an id outside the workspace', async () => {
            const { secret } = await mintToken('read');
            const list = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            const id = (list.body.items as EntryItem[])[0].id;

            await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            // A well-formed but foreign/unknown id reads as 404.
            await request(harness.server)
                .get(
                    '/api/v1/content/test_article/00000000-0000-0000-0000-000000000000'
                )
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });
    });

    describe('schema discovery', () => {
        it('lists content-type summaries and one type’s schema', async () => {
            const { secret } = await mintToken('read');
            const summaries = await request(harness.server)
                .get('/api/v1/content-schema')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(
                (summaries.body as { name: string }[]).some(
                    (type) => type.name === 'test_article'
                )
            ).toBe(true);

            await request(harness.server)
                .get('/api/v1/content-schema/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            await request(harness.server)
                .get('/api/v1/content-schema/nope')
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });
    });
});
