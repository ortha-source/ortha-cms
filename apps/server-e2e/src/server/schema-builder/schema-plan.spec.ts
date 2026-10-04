import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
    seedWorkspace
} from '../../support/seed';
import {
    buildSourceTree,
    handWrite,
    removeSourceTree,
    snapshotDir
} from '../../support/schema-builder';

const ADMIN_EMAIL = 'schema-plan-admin@example.com';
const CONTRIBUTOR_EMAIL = 'schema-plan-contributor@example.com';
const PASSWORD = 'SecurePass123!';

interface FieldEntry {
    key: string;
    name: string;
    spec: Record<string, unknown>;
}
interface TypeDoc {
    name: string;
    fields: FieldEntry[];
    [key: string]: unknown;
}
interface Envelope {
    document: { version: 1; types: TypeDoc[] };
    fingerprint: string;
}

jest.setTimeout(120_000);

/**
 * `POST /api/schema-builder/plan` (ADR-0020): what an apply of a draft would
 * do — the classified changes, the files, drizzle-kit's SQL — without doing
 * it. Exercised against a real project tree whose types are the harness's,
 * written as the builder writes them, with a snapshot that matches.
 */
describe('Schema builder plan (POST /api/schema-builder/plan)', () => {
    let readOnly: TestApp;
    let editable: TestApp;
    let root: string;

    beforeAll(async () => {
        root = await buildSourceTree();
        readOnly = await createTestApp();
        editable = await createTestApp({
            schemaBuilder: { enabled: true, projectRoot: root }
        });
    });

    afterAll(async () => {
        await closeTestApp(readOnly);
        await closeTestApp(editable);
        removeSourceTree(root);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(editable.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        await seedActiveUser(editable.app, {
            email: CONTRIBUTOR_EMAIL,
            password: PASSWORD,
            role: 'contributor'
        });
    });

    async function login(app: TestApp, email = ADMIN_EMAIL) {
        const agent = request.agent(app.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    async function current(app: TestApp = editable): Promise<Envelope> {
        const agent = await login(app);
        return (await agent.get('/api/schema-builder/document').expect(200))
            .body as Envelope;
    }

    /** The served document with `edit` applied to one type. */
    function draftOf(
        envelope: Envelope,
        type: string,
        edit: (doc: TypeDoc) => TypeDoc
    ) {
        return {
            ...envelope.document,
            types: envelope.document.types.map((doc) =>
                doc.name === type ? edit(doc) : doc
            )
        };
    }

    const addField =
        (name: string, spec: Record<string, unknown>) => (doc: TypeDoc) => ({
            ...doc,
            fields: [...doc.fields, { key: `${doc.name}.${name}`, name, spec }]
        });
    const dropField = (name: string) => (doc: TypeDoc) => ({
        ...doc,
        fields: doc.fields.filter((field) => field.name !== name)
    });

    describe('authorization', () => {
        it('401s an unauthenticated request', async () => {
            await request(editable.server)
                .post('/api/schema-builder/plan')
                .send({})
                .expect(401);
        });

        it('403s a role without schema:manage', async () => {
            const envelope = await current();
            const agent = await login(editable, CONTRIBUTOR_EMAIL);
            await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: envelope.document,
                    baseFingerprint: envelope.fingerprint
                })
                .expect(403);
        });

        it('403s on a server that may not edit, saying why [schema-builder:I-01]', async () => {
            await seedActiveUser(readOnly.app, {
                email: 'ro-admin@example.com',
                password: PASSWORD,
                role: 'admin'
            });
            const agent = await login(readOnly, 'ro-admin@example.com');
            const envelope = (await agent.get('/api/schema-builder/document'))
                .body as Envelope;
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: envelope.document,
                    baseFingerprint: envelope.fingerprint
                })
                .expect(403);
            expect(body).toMatchObject({
                code: 'schema-builder.disabled',
                details: { reason: 'disabled' }
            });
        });
    });

    describe('refusals', () => {
        it('400s a body whose document is not a document, listing the problems', async () => {
            const agent = await login(editable);
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: { version: 1, types: [{}] },
                    baseFingerprint: '0123456789abcdef'
                })
                .expect(400);
            expect(body.code).toBe('schema-builder.invalid-document');
            expect(body.details.problems).toContain('types[0].name is missing');
        });

        it('400s a malformed fingerprint before the use case runs', async () => {
            const agent = await login(editable);
            await agent
                .post('/api/schema-builder/plan')
                .send({ document: {}, baseFingerprint: 'nope' })
                .expect(400);
        });

        it('409s a draft made against another fingerprint [schema-builder:I-06]', async () => {
            const envelope = await current();
            const agent = await login(editable);
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: envelope.document,
                    baseFingerprint: 'ffffffffffffffff'
                })
                .expect(409);
            expect(body).toMatchObject({
                code: 'schema-builder.stale',
                details: { currentFingerprint: envelope.fingerprint }
            });
        });

        it('422s a draft that breaks a schema rule, with the kernel’s issues', async () => {
            const envelope = await current();
            const agent = await login(editable);
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: draftOf(
                        envelope,
                        'test_tag',
                        addField('id', { type: 'text' })
                    ),
                    baseFingerprint: envelope.fingerprint
                })
                .expect(422);
            expect(body.code).toBe('schema-builder.invalid');
            expect(body.details.issues.length).toBeGreaterThan(0);
        });
    });

    describe('a plan', () => {
        it('previews an added field: safe, the files that change, and drizzle-kit’s SQL', async () => {
            const envelope = await current();
            const agent = await login(editable);
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: draftOf(
                        envelope,
                        'test_tag',
                        addField('color', { type: 'text' })
                    ),
                    baseFingerprint: envelope.fingerprint
                })
                .expect(200);

            expect(body).toMatchObject({
                baseFingerprint: envelope.fingerprint,
                blocked: false
            });
            expect(body.changes).toEqual([
                expect.objectContaining({
                    id: 'field.add:test_tag.color',
                    safety: 'safe'
                })
            ]);
            expect(
                body.files.map((file: { path: string }) => file.path)
            ).toEqual(['collections/test_tag.ts']);
            expect(body.files[0].after).toContain('color: field.text()');
            expect(body.sql).toHaveLength(1);
            expect(body.sql[0]).toContain(
                'ALTER TABLE "content_test_tag" ADD COLUMN "color" text'
            );
        });

        it('previews a removal and an addition as two migrations, removals first — never a rename question', async () => {
            const envelope = await current();
            const agent = await login(editable);
            const draft = draftOf(envelope, 'test_tag', (doc) =>
                addField('colour', { type: 'text' })(dropField('slug')(doc))
            );
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: draft,
                    baseFingerprint: envelope.fingerprint
                })
                .expect(200);

            expect(
                body.changes.map((change: { id: string; safety: string }) => [
                    change.id,
                    change.safety
                ])
            ).toEqual(
                expect.arrayContaining([
                    ['field.remove:test_tag.slug', 'destructive'],
                    ['field.add:test_tag.colour', 'safe']
                ])
            );
            expect(body.sql).toHaveLength(2);
            expect(body.sql[0]).toContain('DROP COLUMN "slug"');
            expect(body.sql[1]).toContain('ADD COLUMN "colour"');
        });

        it('answers a blocked draft with its verdicts and nothing staged — a granted type cannot go', async () => {
            const workspace = await seedWorkspace({
                name: 'Plan WS',
                slug: 'plan-ws'
            });
            await seedContentGrants(workspace.id, ['test_tag']);
            const envelope = await current();
            const agent = await login(editable);
            // test_tag goes, and every relation to it, so the draft is valid
            // and only the grant stands in the way.
            const draft = {
                ...envelope.document,
                types: envelope.document.types
                    .filter((type) => type.name !== 'test_tag')
                    .map((type) => ({
                        ...type,
                        fields: type.fields.filter(
                            (field) => field.spec['to'] !== 'test_tag'
                        )
                    }))
            };
            const { body } = await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: draft,
                    baseFingerprint: envelope.fingerprint
                })
                .expect(200);
            expect(body).toMatchObject({ blocked: true, files: [], sql: [] });
            expect(body.changes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'type.remove:test_tag',
                        safety: 'blocked',
                        reason: 'type-in-use'
                    })
                ])
            );
        });

        it('writes nothing the app reads, and leaves no scratch folder behind', async () => {
            const before = snapshotDir(root);
            const envelope = await current();
            const agent = await login(editable);
            await agent
                .post('/api/schema-builder/plan')
                .send({
                    document: draftOf(
                        envelope,
                        'test_tag',
                        addField('color', { type: 'text' })
                    ),
                    baseFingerprint: envelope.fingerprint
                })
                .expect(200);
            expect(snapshotDir(root)).toEqual(before);
            expect(existsSync(join(root, '.orthacms/plan'))).toBe(true);
            expect(snapshotDir(join(root, '.orthacms/plan'))).toEqual({});
        });
    });

    describe('ownership [schema-builder:I-02]', () => {
        it('422s a change to a hand-written type, naming it', async () => {
            const restore = handWrite(root, 'collections/test_seo.ts');
            try {
                const envelope = await current();
                expect(
                    envelope.document.types.find(
                        (type) => type.name === 'test_seo'
                    )?.['origin']
                ).toBe('code');
                const agent = await login(editable);
                const { body } = await agent
                    .post('/api/schema-builder/plan')
                    .send({
                        document: draftOf(
                            envelope,
                            'test_seo',
                            addField('noindex', { type: 'boolean' })
                        ),
                        baseFingerprint: envelope.fingerprint
                    })
                    .expect(422);
                expect(body).toMatchObject({
                    code: 'schema-builder.not-owned',
                    details: { types: ['test_seo'] }
                });
            } finally {
                restore();
            }
        });
    });
});
