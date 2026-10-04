import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { GENERATED_MARKER } from '@orthacms/schema-builder-domain';
import { testContentTypes } from '../../support/content';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedUserWithEmptyRole
} from '../../support/seed';

const ADMIN_EMAIL = 'schema-admin@example.com';
const NORIGHTS_EMAIL = 'schema-norights@example.com';
const PASSWORD = 'SecurePass123!';

interface FieldEntry {
    key: string;
    name: string;
    spec: Record<string, unknown>;
}
interface TypeDoc {
    name: string;
    kind: string;
    origin: string;
    groups: unknown[];
    fields: FieldEntry[];
    [key: string]: unknown;
}

async function login(server: TestApp['server'], email: string) {
    const agent = request.agent(server);
    await agent
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(201);
    return agent;
}

function typeOf(
    body: { document: { types: TypeDoc[] } },
    name: string
): TypeDoc {
    const found = body.document.types.find((type) => type.name === name);
    if (!found) throw new Error(`no ${name} in the document`);
    return found;
}

function specOf(type: TypeDoc, field: string): Record<string, unknown> {
    const found = type.fields.find((entry) => entry.name === field);
    if (!found) throw new Error(`no ${type.name}.${field} in the document`);
    return found.spec;
}

/**
 * `GET /api/schema-builder/document` — the content model the running registry
 * serves, as the schema builder edits it (ADR-0020). Read-only: the harness
 * points the builder at no source tree, so every type is hand-written and
 * editing is off unless a suite builds a tree and turns it on.
 */
describe('Schema builder document (GET /api/schema-builder/document)', () => {
    let harness: TestApp;

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
    });

    describe('authorization', () => {
        it('401s an unauthenticated request', async () => {
            await request(harness.server)
                .get('/api/schema-builder/document')
                .expect(401);
        });

        it('403s a user whose role lacks content:read', async () => {
            await seedUserWithEmptyRole(harness.app, {
                email: NORIGHTS_EMAIL,
                password: PASSWORD,
                roleKey: 'schema-norights'
            });
            const agent = await login(harness.server, NORIGHTS_EMAIL);
            await agent.get('/api/schema-builder/document').expect(403);
        });

        it('needs no workspace header — the model is global', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            await agent.get('/api/schema-builder/document').expect(200);
        });
    });

    describe('the envelope', () => {
        it('lists every registered type, in registration order', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent
                .get('/api/schema-builder/document')
                .expect(200);

            expect(body.document.version).toBe(1);
            expect(
                body.document.types.map((type: TypeDoc) => type.name)
            ).toEqual(testContentTypes.map((type) => type.name));
        });

        it('carries a fingerprint and a boot id that hold still between reads', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const first = await agent.get('/api/schema-builder/document');
            const second = await agent.get('/api/schema-builder/document');

            expect(first.body.fingerprint).toMatch(/^[0-9a-f]{16}$/);
            expect(first.body.bootId).toMatch(/^[0-9a-f-]{36}$/);
            expect(second.body.fingerprint).toBe(first.body.fingerprint);
            expect(second.body.bootId).toBe(first.body.bootId);
        });

        it('says editing is off, and why, without a source tree', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent
                .get('/api/schema-builder/document')
                .expect(200);

            expect(body.capabilities).toEqual({
                editable: false,
                reason: 'disabled',
                restart: 'manual'
            });
            expect(
                body.document.types.every(
                    (type: TypeDoc) => type.origin === 'code'
                )
            ).toBe(true);
        });
    });

    describe('what a type reads as', () => {
        it('keeps the declared type options, and the label only where it says something', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent.get('/api/schema-builder/document');
            const article = typeOf(body, 'test_article');

            expect(article).toMatchObject({
                kind: 'collection',
                label: 'Articles',
                publishable: true,
                paranoid: true,
                i18n: true
            });
            expect(typeOf(body, 'test_landing').kind).toBe('single');
        });

        it('keys each field by type and name, in declaration order', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent.get('/api/schema-builder/document');
            const article = typeOf(body, 'test_article');

            expect(article.fields[0]).toMatchObject({
                key: 'test_article.text',
                name: 'text'
            });
            expect(article.fields.map((entry) => entry.name)).toEqual(
                Object.keys(
                    testContentTypes.find(
                        (type) => type.name === 'test_article'
                    )!.fields
                )
            );
        });

        it('carries validation and display options as declared', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent.get('/api/schema-builder/document');
            const article = typeOf(body, 'test_article');

            expect(specOf(article, 'text')).toEqual({
                type: 'text',
                required: true,
                localized: true,
                minLength: 3,
                maxLength: 200,
                admin: {
                    label: 'Text',
                    description:
                        'A short single-line string (3–200 characters).'
                }
            });
            expect(specOf(article, 'number')).toMatchObject({
                integer: true,
                min: 1,
                max: 120
            });
            // Money is minor units: `integer` is the DSL's, not the author's.
            expect(specOf(article, 'money')).not.toHaveProperty('integer');
            expect(specOf(article, 'select')).toMatchObject({
                options: ['article', 'tutorial', 'changelog'],
                required: true
            });
            expect(specOf(article, 'image')).toMatchObject({
                accept: { kinds: ['image'] }
            });
            expect(specOf(article, 'attachments')).toMatchObject({
                multiple: true
            });
        });

        it('names relation targets and leaves the DSL defaults implicit', async () => {
            const agent = await login(harness.server, ADMIN_EMAIL);
            const { body } = await agent.get('/api/schema-builder/document');
            const article = typeOf(body, 'test_article');

            // `onDelete: 'set null'` is what an optional relation gets anyway.
            expect(specOf(article, 'author')).toMatchObject({
                to: 'test_author'
            });
            expect(specOf(article, 'author')).not.toHaveProperty('onDelete');
            expect(specOf(article, 'seo')).toMatchObject({
                to: 'test_seo',
                unique: true
            });
            expect(specOf(article, 'tags')).toMatchObject({
                to: 'test_tag',
                many: true
            });
            // The one opt-out of the shared default, kept because it differs.
            expect(specOf(article, 'pinnedTag')).toMatchObject({
                syncAcrossLocales: false
            });
            expect(specOf(typeOf(body, 'test_tag'), 'articles')).toEqual(
                expect.objectContaining({
                    type: 'relation',
                    to: 'test_article',
                    inverseOf: 'tags'
                })
            );
        });
    });

    describe('with a source tree and editing on', () => {
        let root: string;
        let editable: TestApp;

        // Both apps share the database, so the admin the outer `beforeEach`
        // seeds can sign in to either.
        beforeAll(async () => {
            // A tree that owns test_article and nothing else: the marker on
            // its first line is the whole of the ownership rule.
            root = mkdtempSync(join(tmpdir(), 'orthacms-e2e-schema-'));
            mkdirSync(join(root, 'src/content/collections'), {
                recursive: true
            });
            writeFileSync(
                join(root, 'src/content/index.ts'),
                `${GENERATED_MARKER}\n`
            );
            writeFileSync(
                join(root, 'src/content/collections/test_article.ts'),
                `${GENERATED_MARKER}\nexport {};\n`
            );
            writeFileSync(
                join(root, 'src/content/collections/test_tag.ts'),
                '// hand-written\nexport {};\n'
            );
            editable = await createTestApp({
                schemaBuilder: {
                    enabled: true,
                    projectRoot: root,
                    restart: 'watch'
                }
            });
        });

        afterAll(async () => {
            await closeTestApp(editable);
            rmSync(root, { recursive: true, force: true });
        });

        it('is editable, and owns only the files that carry the marker', async () => {
            const agent = await login(editable.server, ADMIN_EMAIL);
            const { body } = await agent
                .get('/api/schema-builder/document')
                .expect(200);

            expect(body.capabilities).toEqual({
                editable: true,
                restart: 'watch'
            });
            expect(typeOf(body, 'test_article').origin).toBe('builder');
            expect(typeOf(body, 'test_tag').origin).toBe('code');
            expect(typeOf(body, 'test_author').origin).toBe('code');
        });

        it('boots with its own id, and fingerprints ownership with the model', async () => {
            // Ownership is part of the document: handing a file over (adding
            // the marker) must invalidate a plan made before it.
            const here = await login(editable.server, ADMIN_EMAIL);
            const there = await login(harness.server, ADMIN_EMAIL);
            const a = await here.get('/api/schema-builder/document');
            const b = await there.get('/api/schema-builder/document');

            expect(a.body.bootId).not.toBe(b.body.bootId);
            expect(a.body.fingerprint).not.toBe(b.body.fingerprint);
            expect(a.body.document.types.map((t: TypeDoc) => t.name)).toEqual(
                b.body.document.types.map((t: TypeDoc) => t.name)
            );
        });
    });
});
