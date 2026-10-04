import { type Page } from '@playwright/test';

/** A field entry as the document route returns it. */
export interface FieldEntrySeed {
    key: string;
    name: string;
    spec: Record<string, unknown> & { type: string };
}

/** A type as the document route returns it. */
export interface TypeDocSeed {
    name: string;
    kind: 'collection' | 'single';
    path?: string;
    label?: string;
    description?: string;
    publishable: boolean;
    paranoid: boolean;
    i18n: boolean;
    groups: {
        key: string;
        label: string;
        description?: string;
        collapsed?: boolean;
    }[];
    fields: FieldEntrySeed[];
    origin: 'builder' | 'code' | 'new';
}

/** `GET /api/schema-builder/document` — the server's envelope. */
export interface SchemaEnvelopeSeed {
    document: { version: 1; types: TypeDocSeed[] };
    fingerprint: string;
    bootId: string;
    capabilities: {
        editable: boolean;
        reason?: 'production' | 'disabled' | 'no-source-tree';
        restart: 'watch' | 'manual';
    };
}

const field = (
    type: string,
    name: string,
    spec: FieldEntrySeed['spec']
): FieldEntrySeed => ({
    key: `${type}.${name}`,
    name,
    spec
});

/**
 * The reference model the suites assert against: an i18n article with a field
 * on every built-in tab and one General-tab group (declared out of rank order,
 * so the rank ordering is observable), an author, and a page.
 */
export const SCHEMA_TYPES_SEED: TypeDocSeed[] = [
    {
        name: 'article',
        kind: 'collection',
        label: 'Articles',
        description: 'Long-form posts.',
        publishable: true,
        paranoid: true,
        i18n: true,
        groups: [
            {
                key: 'seo',
                label: 'SEO',
                description: 'Search engines',
                collapsed: true
            }
        ],
        fields: [
            field('article', 'body', { type: 'richtext', localized: true }),
            field('article', 'title', {
                type: 'text',
                required: true,
                admin: { label: 'Title' }
            }),
            field('article', 'kind', {
                type: 'select',
                options: ['news', 'opinion']
            }),
            field('article', 'author', { type: 'relation', to: 'author' }),
            field('article', 'cover', {
                type: 'media',
                accept: { kinds: ['image'] }
            }),
            field('article', 'slug', { type: 'text', admin: { group: 'seo' } })
        ],
        origin: 'code'
    },
    {
        name: 'author',
        kind: 'collection',
        label: 'Authors',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [
            field('author', 'name', { type: 'text', required: true }),
            field('author', 'articles', {
                type: 'relation',
                to: 'article',
                inverseOf: 'author'
            })
        ],
        origin: 'builder'
    },
    {
        name: 'home',
        kind: 'single',
        path: '/',
        label: 'Home',
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [field('home', 'headline', { type: 'text' })],
        origin: 'code'
    }
];

/** Options for {@link mockSchemaDocument}. */
export interface SchemaDocumentOptions {
    /** The model; a function is read per request, so a spec can change it on a restart. */
    types?: TypeDocSeed[] | (() => TypeDocSeed[]);
    capabilities?: SchemaEnvelopeSeed['capabilities'];
    /** Answer `500` — the shared client retries before the error state shows. */
    fails?: boolean;
    /** Hold the response open, to observe the loading state. */
    delayMs?: number;
    /** The boot id to answer with — read per request, so a spec can restart the server. */
    bootId?: () => string;
}

/**
 * Stub `GET /api/schema-builder/document`. Returns a counter, so a spec can
 * assert the page sent no request at all (the no-access state).
 */
export async function mockSchemaDocument(
    page: Page,
    {
        types = SCHEMA_TYPES_SEED,
        capabilities = {
            editable: false,
            reason: 'disabled',
            restart: 'watch'
        },
        fails = false,
        delayMs,
        bootId = () => 'boot-e2e'
    }: SchemaDocumentOptions = {}
): Promise<{ readonly count: number }> {
    const calls = { count: 0 };
    await page.route('**/api/schema-builder/document', async (route) => {
        calls.count += 1;
        if (delayMs)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (fails) {
            return route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: '{"message":"boom"}'
            });
        }
        const body: SchemaEnvelopeSeed = {
            document: {
                version: 1,
                types: typeof types === 'function' ? types() : types
            },
            fingerprint: '0123456789abcdef',
            bootId: bootId(),
            capabilities
        };
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });
    });
    return calls;
}

/** One change as the plan route classifies it. */
export interface ClassifiedChangeSeed {
    id: string;
    change: Record<string, unknown> & { kind: string; type: string };
    safety: 'safe' | 'data' | 'destructive' | 'blocked';
    reason: string;
    storage: boolean;
}

/** `POST /api/schema-builder/plan` — what an apply would do. */
export interface SchemaPlanSeed {
    baseFingerprint: string;
    changes: ClassifiedChangeSeed[];
    blocked: boolean;
    files: { path: string; before: string | null; after: string | null }[];
    sql: string[];
}

/** A plan that adds the `events` collection — what the suites' new type produces. */
export const ADD_EVENTS_PLAN: SchemaPlanSeed = {
    baseFingerprint: '0123456789abcdef',
    changes: [
        {
            id: 'type.add:events',
            change: { kind: 'type.add', type: 'events' },
            safety: 'safe',
            reason: 'new-type',
            storage: true
        }
    ],
    blocked: false,
    files: [
        {
            path: 'collections/events.ts',
            before: null,
            after: "// @orthacms-generated\nexport const events = collection('events', {});\n"
        }
    ],
    sql: ['CREATE TABLE "events" ("id" uuid PRIMARY KEY NOT NULL);']
};

/** Options for {@link mockSchemaApply}. */
export interface SchemaApplyOptions {
    plan?: SchemaPlanSeed;
    /** Hold the plan open, to observe the review's skeleton. */
    planDelayMs?: number;
    /** Answer the plan with this status instead (409 = stale document). */
    planStatus?: number;
    /** How the operation ends; `failed` carries `error`. */
    outcome?: 'succeeded' | 'failed';
    error?: { code: string; message: string };
}

/** What a spec can assert about the apply routes afterwards. */
export interface SchemaApplyCalls {
    /** True once the apply has finished — the server "restarted". */
    restarted: boolean;
    plans: unknown[];
    applies: Record<string, unknown>[];
    grants: { workspaceId: string; slug: string }[];
}

/**
 * Stub the write half of the builder: plan, apply, the operation, the restart
 * and the workspace grant. The apply answers `202`; the operation runs once,
 * then ends with `outcome`. A successful one sets `restarted`, which
 * {@link mockSchemaDocument}'s `bootId` reads to answer as the new process.
 */
export async function mockSchemaApply(
    page: Page,
    {
        plan = ADD_EVENTS_PLAN,
        planDelayMs,
        planStatus,
        outcome = 'succeeded',
        error
    }: SchemaApplyOptions = {}
): Promise<SchemaApplyCalls> {
    const calls: SchemaApplyCalls = {
        restarted: false,
        plans: [],
        applies: [],
        grants: []
    };
    let polls = 0;
    const json = (status: number, body: unknown) => ({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body)
    });

    await page.route('**/api/schema-builder/plan', async (route) => {
        calls.plans.push(route.request().postDataJSON());
        if (planDelayMs)
            await new Promise((resolve) => setTimeout(resolve, planDelayMs));
        if (planStatus)
            return route.fulfill(
                json(planStatus, { statusCode: planStatus, message: 'Stale.' })
            );
        return route.fulfill(json(200, plan));
    });
    await page.route('**/api/schema-builder/apply', async (route) => {
        calls.applies.push(route.request().postDataJSON());
        return route.fulfill(
            json(202, { operationId: 'op-e2e', bootId: 'boot-e2e' })
        );
    });
    await page.route('**/api/schema-builder/operations/*', async (route) => {
        polls += 1;
        const done = polls > 1;
        if (done && outcome === 'succeeded') calls.restarted = true;
        return route.fulfill(
            json(200, {
                id: 'op-e2e',
                status: done ? outcome : 'running',
                step: done && outcome === 'succeeded' ? null : 'migrate',
                migrations: [],
                files: [],
                bootId: 'boot-e2e',
                startedAt: '2026-10-04T00:00:00.000Z',
                ...(done && outcome === 'failed' ? { error } : {})
            })
        );
    });
    await page.route('**/api/workspaces/*/content', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        const workspaceId = route.request().url().split('/').at(-2) ?? '';
        const { slug } = route.request().postDataJSON() as { slug: string };
        calls.grants.push({ workspaceId, slug });
        return route.fulfill(json(201, { slug }));
    });
    return calls;
}
