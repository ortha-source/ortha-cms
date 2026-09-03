import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-upload-cap-admin@example.com';
/**
 * The upload cap, on an app booted with a **1 KB** `maxUploadBytes`.
 *
 * Its own file on purpose: the limit is per-app config (and the harness gives
 * one pool per spec file), and the point of the suite is that the host's config
 * value is what the route enforces. It used to
 * be a module-level `process.env['MEDIA_MAX_UPLOAD_BYTES']` read inside the
 * controllers, so this override would have changed nothing and both cases below
 * would have passed under the 50 MB default.
 */
describe('media upload cap (config-driven)', () => {
    const CAP = 1024;
    let harness: TestApp;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp({ maxUploadBytes: CAP });
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        workspace = await seedWorkspace({ name: 'Cap', slug: 'cap' });
        await seedMembership(admin.id, workspace.id);
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    it('accepts a file of exactly the cap [media:I-21]', async () => {
        // busboy raises its limit at `fileSize === fileSizeLimit`, not `>`, so
        // passing the cap verbatim rejected a file of exactly the documented
        // maximum. "Maximum upload size" has to include the maximum.
        const agent = await login();

        await agent
            .post('/api/media/assets')
            .attach('file', Buffer.alloc(CAP, 1), {
                filename: 'exact.bin',
                contentType: 'application/octet-stream'
            })
            .expect(201);
    });

    it('rejects one byte over the cap with a 413 that names the limit [media:I-21]', async () => {
        const agent = await login();

        const res = await agent
            .post('/api/media/assets')
            .attach('file', Buffer.alloc(CAP + 1, 1), {
                filename: 'over.bin',
                contentType: 'application/octet-stream'
            })
            .expect(413);

        // `MulterUploadFilter`'s message, which was unreachable while the
        // filter only matched the raw multer error code — `FileInterceptor`
        // had already turned it into a PayloadTooLargeException('File too
        // large') by the time the filter saw it.
        expect(res.body.message).toBe('File exceeds the maximum upload size.');
    });

    it('applies the same cap to the token upload route [media:I-21]', async () => {
        const agent = await login();
        const minted = await agent
            .post('/api/api-tokens')
            .send({
                name: 'cap-token',
                workspaceIds: [workspace.id],
                scope: 'full'
            })
            .expect(201);

        await request(harness.server)
            .post('/api/v1/media/assets')
            .set('Authorization', `Bearer ${minted.body.secret}`)
            .attach('file', Buffer.alloc(CAP + 1, 1), {
                filename: 'over.bin',
                contentType: 'application/octet-stream'
            })
            .expect(413);
    });
});
