import request from 'supertest';
import { sql } from 'drizzle-orm';
import { getDatabase } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedContentGrants,
    seedMembership,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'publish-context-admin@example.com';
const PASSWORD = 'SecurePass123!';
const ARTICLE = { text: 'Hello world', select: 'article' } as const;

/** One record of the publish context, as far as these assertions care. */
interface ContextRecord {
    id: string;
    type: string;
    title?: string;
    status: string;
    publishedAt: string | null;
    locale?: string;
    localeGroupId?: string;
}
interface ContextLink extends ContextRecord {
    field: string;
    fieldLabel: string;
}
interface ContextEntry extends ContextRecord {
    linked: ContextLink[];
    linkedTruncated: boolean;
}

/**
 * `POST /api/content/:type/bulk/publish/context` — what the admin's Publish
 * Manager reads before it offers anything: each requested entry described,
 * and the **unpublished records it links to** that this workspace could
 * publish alongside it. It writes nothing; the publish is the ordinary bulk
 * publish, per type.
 *
 * `test_article` links `author` (a single relation to the localized
 * `test_author`), `tags` (a many-to-many to `test_tag`) and `seo` (a
 * one-to-one to the **non-publishable** `test_seo`).
 */
describe('Bulk publish context (POST /content/:type/bulk/publish/context) [content:I-57]', () => {
    let harness: TestApp;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'Ctx', slug: 'ctx' })).id;
        await seedMembership(admin.id, workspaceId);
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function create(
        agent: request.Agent,
        type: string,
        body: Record<string, unknown>
    ): Promise<string> {
        const res = await agent.post(`/api/content/${type}`).send(body);
        expect(res.status).toBe(201);
        return res.body.id as string;
    }

    async function publish(agent: request.Agent, type: string, id: string) {
        await agent.post(`/api/content/${type}/${id}/publish`).expect(201);
    }

    /** A draft article linking a draft author, a draft tag and a live tag. */
    async function seedGraph(agent: request.Agent) {
        const author = await create(agent, 'test_author', {
            values: { name: 'Ada' }
        });
        const draftTag = await create(agent, 'test_tag', {
            values: { name: 'Draft tag' }
        });
        const liveTag = await create(agent, 'test_tag', {
            values: { name: 'Live tag' }
        });
        await publish(agent, 'test_tag', liveTag);
        const seo = await create(agent, 'test_seo', {
            values: { metaTitle: 'Home' }
        });
        const article = await create(agent, 'test_article', {
            values: { ...ARTICLE, author, seo },
            relations: { tags: { link: [draftTag, liveTag] } }
        });
        return { author, draftTag, liveTag, article };
    }

    async function context(
        agent: request.Agent,
        type: string,
        ids: string[],
        expectStatus = 200
    ) {
        return agent
            .post(`/api/content/${type}/bulk/publish/context`)
            .send({ ids })
            .expect(expectStatus);
    }

    it('describes each entry and offers the drafts it links to', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const { author, draftTag, article } = await seedGraph(agent);
        const unknown = '3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91';

        // A read behind a POST: 200, not 201.
        const res = await context(agent, 'test_article', [article, unknown]);
        const entries = res.body.entries as Record<string, ContextEntry | null>;

        expect(Object.keys(entries).sort()).toEqual([article, unknown].sort());
        expect(entries[unknown]).toBeNull();

        const entry = entries[article] as ContextEntry;
        expect(entry).toMatchObject({
            id: article,
            type: 'test_article',
            title: 'Hello world',
            status: 'draft',
            publishedAt: null,
            locale: 'en',
            linkedTruncated: false
        });
        expect(typeof entry.localeGroupId).toBe('string');

        // Field order — `author` before `tags`. The live tag is not an offer,
        // and the non-publishable `seo` target never is.
        expect(entry.linked.map((link) => [link.field, link.id])).toEqual([
            ['author', author],
            ['tags', draftTag]
        ]);
        expect(entry.linked[0]).toMatchObject({
            type: 'test_author',
            title: 'Ada',
            fieldLabel: 'Author',
            status: 'draft',
            locale: 'en'
        });
        // A non-localized target carries no locale fields at all.
        expect(entry.linked[1]).not.toHaveProperty('locale');
        expect(entry.linked[1]).not.toHaveProperty('localeGroupId');
    });

    it('counts a published-then-edited target as a draft to offer', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const { draftTag, article } = await seedGraph(agent);
        await publish(agent, 'test_tag', draftTag);
        await agent
            .patch(`/api/content/test_tag/${draftTag}`)
            .send({ values: { name: 'Edited tag' } })
            .expect(200);

        const res = await context(agent, 'test_article', [article]);
        const tag = (res.body.entries[article] as ContextEntry).linked.find(
            (link) => link.id === draftTag
        );
        // Modified: draft over live content — the edits are not what links show.
        expect(tag?.status).toBe('draft');
        expect(tag?.publishedAt).not.toBeNull();
    });

    it('leaves out a target type the workspace holds no own grant for', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const { author, article } = await seedGraph(agent);
        // Re-grant without tags: an offer this workspace could not publish
        // (bulk publish would 404) is no offer.
        await resetGrants(['test_article', 'test_author']);

        const res = await context(agent, 'test_article', [article]);
        expect(
            (res.body.entries[article] as ContextEntry).linked.map(
                (link) => link.id
            )
        ).toEqual([author]);
    });

    it('leaves out a trashed target', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const { author, draftTag, article } = await seedGraph(agent);
        await agent
            .post('/api/content/test_author/bulk/delete')
            .send({ ids: [author] })
            .expect(200);

        const res = await context(agent, 'test_article', [article]);
        expect(
            (res.body.entries[article] as ContextEntry).linked.map(
                (link) => link.id
            )
        ).toEqual([draftTag]);
    });

    it('400s on a type with no publish state', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const seo = await create(agent, 'test_seo', {
            values: { metaTitle: 'Home' }
        });
        await context(agent, 'test_seo', [seo], 400);
    });

    it('caps the request like every bulk action', async () => {
        await seedAllContentGrants(workspaceId);
        const agent = await login();
        const ids = Array.from(
            { length: 101 },
            (_, i) => `3f1a7c1e-9d2b-4a6f-8c11-${String(i).padStart(12, '0')}`
        );
        await context(agent, 'test_article', ids, 400);
    });

    /** Replace the workspace's grants with exactly `slugs`. */
    async function resetGrants(slugs: string[]) {
        await getDatabase().execute(
            sql`delete from workspace_content where workspace_id = ${workspaceId}::uuid`
        );
        await seedContentGrants(workspaceId, slugs);
    }
});
