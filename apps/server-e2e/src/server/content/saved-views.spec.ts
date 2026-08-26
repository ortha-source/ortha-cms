import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedUserWithPermissions,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const OWNER_EMAIL = 'saved-views-owner@example.com';
const OTHER_EMAIL = 'saved-views-other@example.com';
const VIEWER_EMAIL = 'saved-views-viewer@example.com';
const PASSWORD = 'SecurePass123!';
const ORIGIN = 'http://localhost:4200';

const SCOPE = 'content:test_article';

/** A minimal, valid payload — the shape the records page captures. */
const PAYLOAD = {
    filter: '{"op":"and","rules":[]}',
    sort: '-updatedAt',
    pageSize: 25,
    columns: ['text', 'select'],
    extra: { locale: 'en' }
} as const;

/**
 * **Saved list views** (`/api/views`).
 *
 * The feature is a bookmark over a list, and the tests below are mostly about
 * the ways a bookmark could quietly become something more:
 *
 *  - its `scope` names a content type, so it must be grant-checked or it
 *    becomes a probe for the content model outside the workspace;
 *  - it is workspace-scoped data, so an id from another workspace must read as
 *    absent rather than as forbidden;
 *  - sharing turns a personal bookmark into a navigation item for everyone, so
 *    it is gated on `views:share` while saving a private one is not;
 *  - and a view is never a grant: reading views at all requires the caller's own
 *    `content:read`.
 */
describe('Saved views (/api/views)', () => {
    let harness: TestApp;
    let owner: SeededUser;
    let other: SeededUser;
    /** Granted `test_article` only. */
    let workspaceId: string;
    /** A second workspace both users belong to, granted the same type. */
    let otherWorkspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        owner = await seedActiveUser(harness.app, {
            email: OWNER_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        other = await seedActiveUser(harness.app, {
            email: OTHER_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });

        const primary = await seedWorkspace({
            name: 'Primary',
            slug: 'primary'
        });
        workspaceId = primary.id;
        await seedMembership(owner.id, workspaceId);
        await seedMembership(other.id, workspaceId);
        await seedContentGrants(workspaceId, ['test_article']);

        const secondary = await seedWorkspace({
            name: 'Secondary',
            slug: 'secondary'
        });
        otherWorkspaceId = secondary.id;
        await seedMembership(owner.id, otherWorkspaceId);
        await seedContentGrants(otherWorkspaceId, ['test_article']);
    });

    async function login(email = OWNER_EMAIL, id = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', id);
        agent.set('Origin', ORIGIN);
        return agent;
    }

    /** Creates a view and returns the response body. */
    async function createView(
        agent: ReturnType<typeof request.agent>,
        body: Record<string, unknown> = {}
    ) {
        const response = await agent
            .post('/api/views')
            .send({
                scope: SCOPE,
                name: 'Needs review',
                payload: PAYLOAD,
                ...body
            })
            .expect(201);
        return response.body;
    }

    describe('creating and listing', () => {
        it('stores the slice and returns it with the caller-relative flags', async () => {
            const agent = await login();
            const view = await createView(agent);

            expect(Object.keys(view).sort()).toEqual(
                [
                    'id',
                    'isDefault',
                    'isOwn',
                    'name',
                    'ownerId',
                    'payload',
                    'scope',
                    'updatedAt',
                    'visibility'
                ].sort()
            );
            expect(view.name).toBe('Needs review');
            expect(view.scope).toBe(SCOPE);
            // Private unless the caller asks otherwise — sharing is opt-in.
            expect(view.visibility).toBe('private');
            expect(view.isOwn).toBe(true);
            expect(view.isDefault).toBe(false);
            // The payload round-trips byte-for-byte: the server stores it
            // opaquely so a view and a hand-edited link replay identically.
            expect(view.payload).toEqual(PAYLOAD);
        });

        it('trims the name, so two views cannot differ by whitespace alone', async () => {
            const agent = await login();
            const view = await createView(agent, { name: '  Needs review  ' });
            expect(view.name).toBe('Needs review');

            await agent
                .post('/api/views')
                .send({ scope: SCOPE, name: 'Needs review', payload: PAYLOAD })
                .expect(409);
        });

        it('lists the caller’s own views for the scope', async () => {
            const agent = await login();
            await createView(agent, { name: 'One' });
            await createView(agent, { name: 'Two' });

            const { body } = await agent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body.map((view: { name: string }) => view.name)).toEqual([
                'One',
                'Two'
            ]);
        });

        it('409s a duplicate name for the same person and list', async () => {
            const agent = await login();
            await createView(agent);
            await agent
                .post('/api/views')
                .send({ scope: SCOPE, name: 'Needs review', payload: PAYLOAD })
                .expect(409);
        });

        it('lets two people each hold a view of the same name', async () => {
            const ownerAgent = await login();
            await createView(ownerAgent);
            const otherAgent = await login(OTHER_EMAIL);
            await createView(otherAgent);
        });
    });

    describe('visibility', () => {
        it('hides a private view from other members', async () => {
            const ownerAgent = await login();
            await createView(ownerAgent, { name: 'Mine only' });

            const otherAgent = await login(OTHER_EMAIL);
            const { body } = await otherAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body).toEqual([]);
        });

        it('shows a shared view to every member, flagged as not theirs', async () => {
            const ownerAgent = await login();
            await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });

            const otherAgent = await login(OTHER_EMAIL);
            const { body } = await otherAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body).toHaveLength(1);
            expect(body[0].name).toBe('Editorial backlog');
            // `isOwn: false` is what disables Save and Delete in the switcher.
            expect(body[0].isOwn).toBe(false);
        });

        it('403s sharing without views:share, while a private view still saves', async () => {
            // A role holding content:read but not views:share — every member can
            // bookmark a list; making the bookmark everyone's is the gated act.
            const noShare = await seedUserWithPermissions(harness.app, {
                email: VIEWER_EMAIL,
                password: PASSWORD,
                roleKey: 'saved-views-no-share',
                permissions: ['content:read', 'workspaces:read']
            });
            await seedMembership(noShare.id, workspaceId);
            const restricted = request.agent(harness.server);
            await restricted
                .post('/api/auth/login')
                .send({ email: VIEWER_EMAIL, password: PASSWORD })
                .expect(201);
            restricted.set('X-Workspace-Id', workspaceId);
            restricted.set('Origin', ORIGIN);

            await restricted
                .post('/api/views')
                .send({
                    scope: SCOPE,
                    name: 'Shared attempt',
                    payload: PAYLOAD,
                    visibility: 'workspace'
                })
                .expect(403);

            await restricted
                .post('/api/views')
                .send({
                    scope: SCOPE,
                    name: 'Personal is fine',
                    payload: PAYLOAD
                })
                .expect(201);
        });

        it('403s reading views without content:read — a view is not a way in', async () => {
            const noRead = await seedUserWithPermissions(harness.app, {
                email: 'saved-views-blind@example.com',
                password: PASSWORD,
                roleKey: 'saved-views-no-read',
                permissions: ['workspaces:read']
            });
            await seedMembership(noRead.id, workspaceId);
            const blind = request.agent(harness.server);
            await blind
                .post('/api/auth/login')
                .send({
                    email: 'saved-views-blind@example.com',
                    password: PASSWORD
                })
                .expect(201);
            blind.set('X-Workspace-Id', workspaceId);

            await blind.get('/api/views').query({ scope: SCOPE }).expect(403);
        });
    });

    describe('only the owner writes', () => {
        it('403s another member editing a shared view', async () => {
            const ownerAgent = await login();
            const view = await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });

            const otherAgent = await login(OTHER_EMAIL);
            await otherAgent
                .patch(`/api/views/${view.id}`)
                .send({ name: 'Renamed by someone else' })
                .expect(403);
        });

        it('403s another member deleting a shared view', async () => {
            const ownerAgent = await login();
            const view = await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });

            const otherAgent = await login(OTHER_EMAIL);
            await otherAgent.delete(`/api/views/${view.id}`).expect(403);
        });

        it('lets the owner re-capture, rename and delete their own', async () => {
            const agent = await login();
            const view = await createView(agent);

            const renamed = await agent
                .patch(`/api/views/${view.id}`)
                .send({ name: 'Renamed', payload: { pageSize: 50 } })
                .expect(200);
            expect(renamed.body.name).toBe('Renamed');
            expect(renamed.body.payload).toEqual({ pageSize: 50 });

            await agent.delete(`/api/views/${view.id}`).expect(204);
            const { body } = await agent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body).toEqual([]);
        });
    });

    describe('workspace isolation', () => {
        it('does not list a view saved in another workspace', async () => {
            const primaryAgent = await login();
            await createView(primaryAgent, { name: 'Primary only' });

            const secondaryAgent = await login(OWNER_EMAIL, otherWorkspaceId);
            const { body } = await secondaryAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body).toEqual([]);
        });

        it('404s — not 403s — a view addressed from another workspace', async () => {
            const primaryAgent = await login();
            const view = await createView(primaryAgent);

            // The caller owns this view and belongs to both workspaces, so a
            // 403 here would confirm it exists somewhere. Absent is the answer.
            const secondaryAgent = await login(OWNER_EMAIL, otherWorkspaceId);
            await secondaryAgent
                .patch(`/api/views/${view.id}`)
                .send({ name: 'Reached across' })
                .expect(404);
            await secondaryAgent.delete(`/api/views/${view.id}`).expect(404);
        });
    });

    describe('scope is grant-checked', () => {
        it('404s an ungranted type exactly as an unknown one', async () => {
            const agent = await login();
            const ungranted = await agent
                .get('/api/views')
                .query({ scope: 'content:test_tag' })
                .expect(404);
            const unknown = await agent
                .get('/api/views')
                .query({ scope: 'content:no_such_type' })
                .expect(404);

            expect(ungranted.body.message).toBe(
                'Unknown content type "test_tag".'
            );
            expect(Object.keys(ungranted.body).sort()).toEqual(
                Object.keys(unknown.body).sort()
            );
        });

        it('404s saving a view over an ungranted type', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({
                    scope: 'content:test_tag',
                    name: 'Sneaky',
                    payload: PAYLOAD
                })
                .expect(404);
        });
    });

    describe('the default view', () => {
        it('sets, reports and clears the caller’s default', async () => {
            const agent = await login();
            const view = await createView(agent);

            await agent.put(`/api/views/${view.id}/default`).expect(204);
            const withDefault = await agent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(withDefault.body[0].isDefault).toBe(true);

            await agent.delete(`/api/views/${view.id}/default`).expect(204);
            const cleared = await agent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(cleared.body[0].isDefault).toBe(false);
        });

        it('is personal — one member’s default is not another’s', async () => {
            const ownerAgent = await login();
            const view = await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });
            await ownerAgent.put(`/api/views/${view.id}/default`).expect(204);

            const otherAgent = await login(OTHER_EMAIL);
            const { body } = await otherAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body[0].isDefault).toBe(false);
        });

        it('lets a member default to a shared view they do not own', async () => {
            const ownerAgent = await login();
            const view = await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });

            const otherAgent = await login(OTHER_EMAIL);
            await otherAgent.put(`/api/views/${view.id}/default`).expect(204);
            const { body } = await otherAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body[0].isDefault).toBe(true);
        });

        it('drops the default with the view it pointed at', async () => {
            const ownerAgent = await login();
            const view = await createView(ownerAgent, {
                name: 'Editorial backlog',
                visibility: 'workspace'
            });
            const otherAgent = await login(OTHER_EMAIL);
            await otherAgent.put(`/api/views/${view.id}/default`).expect(204);

            await ownerAgent.delete(`/api/views/${view.id}`).expect(204);

            // The cascade cleared the other member's pointer too — they fall
            // back to the plain list rather than to a dangling id.
            const { body } = await otherAgent
                .get('/api/views')
                .query({ scope: SCOPE })
                .expect(200);
            expect(body).toEqual([]);
        });
    });

    describe('validation', () => {
        it('400s an unknown field (the pipe is forbidNonWhitelisted)', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({
                    scope: SCOPE,
                    name: 'Extra',
                    payload: PAYLOAD,
                    surprise: true
                })
                .expect(400);
        });

        it('400s a scope outside content:<typeName>', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({ scope: 'users:members', name: 'X', payload: PAYLOAD })
                .expect(400);
        });

        it('400s an empty name', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({ scope: SCOPE, name: '   ', payload: PAYLOAD })
                .expect(400);
        });

        it('400s a page size beyond the list endpoint’s own cap', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({
                    scope: SCOPE,
                    name: 'Too big',
                    payload: { pageSize: 5000 }
                })
                .expect(400);
        });

        it('400s a nested or non-string extra bag', async () => {
            const agent = await login();
            await agent
                .post('/api/views')
                .send({
                    scope: SCOPE,
                    name: 'Nested',
                    payload: { extra: { locale: { deep: 'no' } } }
                })
                .expect(400);
        });

        it('answers an empty patch with the row unchanged, not a 500', async () => {
            // Every field is optional, so `{}` passes the pipe. It must not
            // reach the update as "set nothing".
            const agent = await login();
            const view = await createView(agent);
            const { body } = await agent
                .patch(`/api/views/${view.id}`)
                .send({})
                .expect(200);
            expect(body.name).toBe('Needs review');
            expect(body.payload).toEqual(PAYLOAD);
        });

        it('400s a malformed view id', async () => {
            const agent = await login();
            await agent
                .patch('/api/views/not-a-uuid')
                .send({ name: 'X' })
                .expect(400);
        });
    });

    describe('authentication', () => {
        it('401s without a session', async () => {
            await request(harness.server)
                .get('/api/views')
                .query({ scope: SCOPE })
                .set('X-Workspace-Id', workspaceId)
                .expect(401);
        });

        it('403s a workspace the caller does not belong to', async () => {
            const stranger = await seedWorkspace({
                name: 'Stranger',
                slug: 'stranger'
            });
            const agent = await login(OTHER_EMAIL, stranger.id);
            await agent.get('/api/views').query({ scope: SCOPE }).expect(403);
        });
    });
});
