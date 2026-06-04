import request from 'supertest';
import { closeTestApp, createTestApp, type TestApp } from '../support/test-app';

describe('server bootstrap', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    it('responds 404 on an unknown route under the global prefix', async () => {
        await request(harness.server).get('/api/does-not-exist').expect(404);
    });
});
