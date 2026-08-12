import { createHash } from 'node:crypto';
import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    archiveWorkspace,
    getActivityRows,
    resetDb,
    seedActiveUser,
    seedUserWithEmptyRole,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'token-admin@example.com';
const NORIGHTS_EMAIL = 'token-norights@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * `/api/api-tokens` — the SESSION-authenticated management API for external-API
 * bearer tokens. Covers minting (plaintext returned once), the multi-workspace
 * bucket, listing (never the secret), revoking, and the `tokens:*` permission
 * gate.
 */
describe('API token management (/api/api-tokens)', () => {
    let harness: TestApp;
    let workspaceId: string;
    let otherWorkspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        otherWorkspaceId = (await seedWorkspace({ name: 'WS B', slug: 'ws-b' }))
            .id;
    });

    /** Logs in and returns a cookie-bearing agent. */
    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('mints a token and returns the plaintext exactly once', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({ name: 'CI', workspaceIds: [workspaceId], scope: 'read' })
            .expect(201);

        expect(res.body.secret).toEqual(expect.any(String));
        expect(res.body.secret.startsWith('orthacms_')).toBe(true);
        expect(res.body.scope).toBe('read');
        expect(res.body.workspaceIds).toEqual([workspaceId]);

        // The list never carries the secret — only the display prefix.
        const list = await agent.get('/api/api-tokens').expect(200);
        expect(list.body.total).toBe(1);
        const [item] = list.body.items;
        expect(item).not.toHaveProperty('secret');
        expect(item).not.toHaveProperty('tokenHash');
        expect(item.lookupPrefix).toEqual(expect.any(String));
    });

    it('mints a token spanning several workspaces', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'multi',
                workspaceIds: [workspaceId, otherWorkspaceId],
                scope: 'read'
            })
            .expect(201);

        expect(res.body.workspaceIds.sort()).toEqual(
            [workspaceId, otherWorkspaceId].sort()
        );

        const list = await agent.get('/api/api-tokens').expect(200);
        expect(list.body.items[0].workspaceIds.sort()).toEqual(
            [workspaceId, otherWorkspaceId].sort()
        );
    });

    it('collapses duplicate workspace ids', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'dupes',
                workspaceIds: [workspaceId, workspaceId],
                scope: 'read'
            })
            .expect(201);

        expect(res.body.workspaceIds).toEqual([workspaceId]);
    });

    it('rejects an empty workspace bucket', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'nowhere', workspaceIds: [], scope: 'read' })
            .expect(400);
    });

    it('rejects a bucket naming a workspace that does not exist', async () => {
        // BUG-identity-server-06. `api_token_workspaces` carries no
        // cross-plugin foreign key, so a typo used to mint happily and leave a
        // row pointing at nothing — a token that reads as configured, grants
        // access to no content, and survives forever because no cascade will
        // ever reach it.
        const agent = await login(ADMIN_EMAIL);
        const phantom = '11111111-1111-4111-8111-111111111111';

        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'phantom',
                workspaceIds: [phantom],
                scope: 'read'
            })
            .expect(400);
        expect(res.body.message).toContain(phantom);

        // Nothing was written — not the token, not the bucket row.
        expect((await agent.get('/api/api-tokens').expect(200)).body.total).toBe(
            0
        );
    });

    it('rejects a bucket that mixes real and phantom workspaces', async () => {
        // Partial validity is still invalid: minting the "real" half would
        // silently narrow a bucket the admin believed they had granted.
        const agent = await login(ADMIN_EMAIL);
        const phantom = '22222222-2222-4222-8222-222222222222';

        await agent
            .post('/api/api-tokens')
            .send({
                name: 'half-real',
                workspaceIds: [workspaceId, phantom],
                scope: 'read'
            })
            .expect(400);

        expect((await agent.get('/api/api-tokens').expect(200)).body.total).toBe(
            0
        );
    });

    it('still accepts an archived workspace — existence, not status', async () => {
        const agent = await login(ADMIN_EMAIL);
        await archiveWorkspace(workspaceId);

        await agent
            .post('/api/api-tokens')
            .send({
                name: 'archived-ok',
                workspaceIds: [workspaceId],
                scope: 'read'
            })
            .expect(201);
    });

    it('lists a multi-workspace token under each of its workspaces', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({
                name: 'multi',
                workspaceIds: [workspaceId, otherWorkspaceId],
                scope: 'read'
            })
            .expect(201);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'solo', workspaceIds: [workspaceId], scope: 'read' })
            .expect(201);

        // Filtering by a workspace is a bucket-membership test — the
        // multi-workspace token appears under both, exactly once each.
        const first = await agent
            .get('/api/api-tokens')
            .query({ workspaceId })
            .expect(200);
        expect(first.body.total).toBe(2);

        const second = await agent
            .get('/api/api-tokens')
            .query({ workspaceId: otherWorkspaceId })
            .expect(200);
        expect(second.body.total).toBe(1);
        expect(second.body.items[0].name).toBe('multi');
    });

    it('rejects an expiry in the past', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({
                name: 'stale',
                workspaceIds: [workspaceId],
                scope: 'read',
                expiresAt: new Date(Date.now() - 60_000).toISOString()
            })
            .expect(400);
    });

    it('revokes a token', async () => {
        const agent = await login(ADMIN_EMAIL);
        const created = await agent
            .post('/api/api-tokens')
            .send({ name: 'temp', workspaceIds: [workspaceId], scope: 'full' })
            .expect(201);

        await agent.delete(`/api/api-tokens/${created.body.id}`).expect(204);

        const list = await agent.get('/api/api-tokens').expect(200);
        const [item] = list.body.items;
        // `revokedAt` is the wire signal; the admin derives its
        // active/expired/revoked badge from it (the view carries no `status`).
        expect(item.revokedAt).not.toBeNull();
    });

    it('gates management on the tokens permissions', async () => {
        await seedUserWithEmptyRole(harness.app, {
            email: NORIGHTS_EMAIL,
            password: PASSWORD,
            roleKey: 'token-mgmt-norights'
        });
        const agent = await login(NORIGHTS_EMAIL);

        await agent.get('/api/api-tokens').expect(403);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'nope', workspaceIds: [workspaceId], scope: 'read' })
            .expect(403);
    });

    it('requires authentication', async () => {
        await request(harness.server).get('/api/api-tokens').expect(401);
    });

    describe('audit trail', () => {
        /** Every `token.*` audit row currently in the log. */
        async function tokenAudit() {
            const rows = await getActivityRows();
            return rows.filter((row) => row.kind.startsWith('token.'));
        }

        it('records token.created when a token is minted', async () => {
            // BUG-identity-server-01: minting and revoking wrote nothing at
            // all, so the log could not answer "who issued this credential,
            // when, and scoped to what" — for a long-lived key to workspace
            // content.
            const agent = await login(ADMIN_EMAIL);
            const created = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'CI',
                    workspaceIds: [workspaceId, otherWorkspaceId],
                    scope: 'read'
                })
                .expect(201);

            const rows = await tokenAudit();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                kind: 'token.created',
                subjectType: 'api_token',
                subjectId: created.body.id,
                actorEmail: ADMIN_EMAIL
            });
            expect(rows[0].meta).toMatchObject({
                name: 'CI',
                scope: 'read',
                lookupPrefix: created.body.lookupPrefix
            });
            expect(
                (rows[0].meta as { workspaceIds: string[] }).workspaceIds.sort()
            ).toEqual([workspaceId, otherWorkspaceId].sort());
        });

        it('never writes the secret or its hash into the log', async () => {
            const agent = await login(ADMIN_EMAIL);
            const created = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'CI',
                    workspaceIds: [workspaceId],
                    scope: 'full'
                })
                .expect(201);

            // `api_tokens` stores only a SHA-256 so a read of the table yields
            // nothing usable; the audit log must not become the second copy.
            const serialised = JSON.stringify(await tokenAudit());
            expect(serialised).not.toContain(created.body.secret);
            expect(serialised).not.toContain(
                createHash('sha256').update(created.body.secret).digest('hex')
            );
        });

        it('records token.revoked when a token is killed', async () => {
            const agent = await login(ADMIN_EMAIL);
            const created = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'temp',
                    workspaceIds: [workspaceId],
                    scope: 'full'
                })
                .expect(201);

            await agent
                .delete(`/api/api-tokens/${created.body.id}`)
                .expect(204);

            const revoked = (await tokenAudit()).filter(
                (row) => row.kind === 'token.revoked'
            );
            expect(revoked).toHaveLength(1);
            expect(revoked[0]).toMatchObject({
                kind: 'token.revoked',
                subjectType: 'api_token',
                subjectId: created.body.id,
                actorEmail: ADMIN_EMAIL
            });
            expect(revoked[0].meta).toMatchObject({ name: 'temp' });
        });

        it('audits a replayed revoke once, not once per call', async () => {
            // The route is idempotent — a second DELETE still 204s — but only
            // the call that actually revoked a live token is an event.
            const agent = await login(ADMIN_EMAIL);
            const created = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'temp',
                    workspaceIds: [workspaceId],
                    scope: 'read'
                })
                .expect(201);

            await agent
                .delete(`/api/api-tokens/${created.body.id}`)
                .expect(204);
            await agent
                .delete(`/api/api-tokens/${created.body.id}`)
                .expect(204);

            expect(
                (await tokenAudit()).filter(
                    (row) => row.kind === 'token.revoked'
                )
            ).toHaveLength(1);
        });

        it('writes nothing when the revoked id is unknown', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .delete('/api/api-tokens/11111111-1111-4111-8111-111111111111')
                .expect(204);

            expect(await tokenAudit()).toEqual([]);
        });

        it('writes no audit row when the mint is rejected', async () => {
            // The event commits with the token or not at all: a rejected mint
            // must leave the log as clean as it leaves `api_tokens`.
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/api-tokens')
                .send({ name: 'nowhere', workspaceIds: [], scope: 'read' })
                .expect(400);

            expect(await tokenAudit()).toEqual([]);
            expect((await agent.get('/api/api-tokens').expect(200)).body.total)
                .toBe(0);
        });
    });
});
