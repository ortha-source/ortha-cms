import { type Page } from '@playwright/test';

/** JSON response helper, mirroring the other mock modules. */
const json = (body: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

/** One rule as `GET /api/alarms/rules` returns it. */
export interface AlarmRuleSeed {
    id: string;
    contentType: string;
    name: string;
    findingTitle: string;
    description: string | null;
    severity: 'error' | 'warn' | 'info';
    filter: Record<string, unknown>;
    enabled: boolean;
    brokenReason: string | null;
    lastScanAt: string | null;
    openCount: number;
}

/** One finding as `GET /api/alarms/findings` returns it. */
export interface AlarmFindingSeed {
    ruleId: string;
    ruleName: string;
    title: string;
    contentType: string;
    entryId: string;
    severity: 'error' | 'warn' | 'info';
    state: 'open' | 'resolved';
    detail: Record<string, unknown> | null;
    firstSeenAt: string;
    lastSeenAt: string;
}

/**
 * The seeded rule — a `contains` condition on a text field.
 *
 * Deliberately the shape from the bug report: the editor has to seed its query
 * builder from this, offer it back for editing, and send the *edited* version
 * on save. A rule whose condition survives none of those three steps looks
 * completely normal on screen.
 */
export const CONTAINS_RULE: AlarmRuleSeed = {
    id: 'rule-1',
    contentType: 'test_article',
    name: 'Should Have',
    findingTitle: 'Title Does not Match',
    description: null,
    severity: 'error',
    // Two conditions, not one: removing a chip then has to leave a *saveable*
    // change behind, which is the state the unsaved notice is about. A
    // single-condition fixture can only ever go from "one" to "none", and
    // "none" is a different message.
    filter: {
        and: [
            { field: 'status', op: 'eq', value: 'published' },
            { field: 'text', op: 'ilike', value: '%QWERT%' }
        ]
    },
    enabled: true,
    brokenReason: null,
    lastScanAt: '2026-08-25T09:00:00.000Z',
    openCount: 1
};

/** The finding that rule has open. */
export const OPEN_FINDING: AlarmFindingSeed = {
    ruleId: CONTAINS_RULE.id,
    ruleName: CONTAINS_RULE.name,
    title: CONTAINS_RULE.findingTitle,
    contentType: 'test_article',
    entryId: 'entry-1',
    severity: 'error',
    state: 'open',
    detail: null,
    firstSeenAt: '2026-08-25T09:00:00.000Z',
    lastSeenAt: '2026-08-25T09:00:00.000Z'
};

/**
 * The filterable paths `GET /api/content-schema/:name/filter-fields` returns.
 *
 * The envelope is `{ fields: [...] }`, and `group` is required on every entry
 * (an empty array for a type's own fields) — `toFilterField` reads it
 * unguarded. A mock that got either wrong would fail inside the mapper rather
 * than in an assertion, which is a slower way to learn the same thing.
 */
export const FILTER_FIELDS = {
    fields: [
        { path: 'text', label: 'Text', type: 'string', group: [] },
        {
            path: 'select',
            label: 'Select',
            type: 'enum',
            enumValues: ['article', 'tutorial'],
            group: []
        },
        { path: 'number', label: 'Number', type: 'number', group: [] },
        {
            path: 'status',
            label: 'Status',
            type: 'enum',
            enumValues: ['draft', 'published'],
            group: []
        },
        // A relation-id path, so the builder's value cell is the record picker
        // rather than a text box — the case that needs `renderRelationValue`.
        {
            path: 'author.id',
            label: 'Author',
            type: 'uuid',
            relationTarget: 'test_author',
            group: ['Author']
        }
    ]
};

/**
 * The type catalogue and one type's schema, as the alarms surface needs them.
 *
 * `i18n: true` is load-bearing: it is what makes the i18n plugin contribute
 * `localeCount` / `hasLocale` / `missingLocale` through
 * `RECORDS_FILTER_FIELDS_SLOT`. Those are the fields a rule saved from the
 * records list can carry and the rule editor could not resolve.
 */
export const CONTENT_TYPE_SUMMARY = {
    name: 'test_article',
    kind: 'collection' as const,
    label: 'Articles',
    publishable: true,
    i18n: true
};

/** The full schema `GET /api/content-schema/:name` returns. */
export const CONTENT_SCHEMA = {
    ...CONTENT_TYPE_SUMMARY,
    fields: [
        {
            name: 'text',
            type: 'text',
            required: true,
            validation: {},
            admin: { label: 'Text' }
        },
        {
            name: 'number',
            type: 'number',
            required: false,
            validation: {},
            admin: { label: 'Number' }
        }
    ]
};

/**
 * The configured locales `GET /api/i18n/locales` returns.
 *
 * The envelope is `{ items }` — `{ locales }` parses as zero locales, and
 * `useLocaleFilterFields` returns nothing at all for an empty set, so the
 * locale fields silently never reach the builder.
 */
export const LOCALES = {
    items: [
        { slug: 'en', name: 'English', isDefault: true },
        { slug: 'de', name: 'German', isDefault: false }
    ]
};

/** What {@link mockAlarmsApi} was asked to do. */
export interface AlarmsApiOptions {
    /** Rules the workspace has. Defaults to {@link CONTAINS_RULE}. */
    rules?: AlarmRuleSeed[];
    /** Findings the list returns. Defaults to {@link OPEN_FINDING}. */
    findings?: AlarmFindingSeed[];
    /**
     * Hold `filter-fields` open for this long.
     *
     * The reason this option exists at all: the query builder's Apply gate
     * rejects **every** rule whose field it cannot resolve, so a rule editor
     * that renders the builder before the surface arrives has an Apply button
     * that silently refuses. Delaying the response is how a browser can prove
     * the editor waits for it instead.
     */
    filterFieldsDelayMs?: number;
    /** Fail `filter-fields`, so the editor must say so rather than go quiet. */
    filterFieldsFailing?: boolean;
    /** How many records the preview call reports as matching. */
    previewMatched?: number;
    /** How many records the collection holds, per the preview call. */
    previewTotal?: number;
}

/** Every PATCH body the editor sent, in order. Reset per `mockAlarmsApi` call. */
export interface AlarmsApiRecorder {
    /** Bodies of `POST /api/alarms/rules`. */
    creates: Record<string, unknown>[];
    /** Bodies of `PATCH /api/alarms/rules/:id`. */
    updates: Record<string, unknown>[];
}

/**
 * Stub the whole `/api/alarms` surface plus the content filter-fields route the
 * rule editor's query builder reads.
 *
 * Returns a recorder so a suite can assert **what the editor sent**, not only
 * what it drew. That distinction is the whole point here: the condition editor
 * looked correct while saving the rule's previous filter, and no assertion
 * about the screen would have caught it.
 */
export async function mockAlarmsApi(
    page: Page,
    options: AlarmsApiOptions = {}
): Promise<AlarmsApiRecorder> {
    const {
        rules = [CONTAINS_RULE],
        findings = [OPEN_FINDING],
        filterFieldsDelayMs = 0,
        filterFieldsFailing = false,
        previewMatched = 3,
        previewTotal = 312
    } = options;

    const recorder: AlarmsApiRecorder = { creates: [], updates: [] };

    // The type catalogue, for the create form's picker. Anchored so it does not
    // also swallow the detail and filter-fields sub-routes below.
    await page.route(/\/api\/content-schema(\?.*)?$/, async (route) => {
        await route.fulfill(json([CONTENT_TYPE_SUMMARY]));
    });

    // One type's schema — what `RECORDS_FILTER_FIELDS_SLOT.useFields` is handed.
    await page.route(
        /\/api\/content-schema\/([^/?]+)(\?.*)?$/,
        async (route) => {
            await route.fulfill(json(CONTENT_SCHEMA));
        }
    );

    await page.route('**/api/i18n/locales*', async (route) => {
        await route.fulfill(json(LOCALES));
    });

    await page.route(
        '**/api/content-schema/*/filter-fields*',
        async (route) => {
            if (filterFieldsDelayMs > 0) {
                await new Promise((resolve) =>
                    setTimeout(resolve, filterFieldsDelayMs)
                );
            }
            if (filterFieldsFailing) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'nope' })
                });
                return;
            }
            await route.fulfill(json(FILTER_FIELDS));
        }
    );

    // **Registered general-first, specific-last, deliberately.** Playwright
    // checks routes in reverse registration order, so the *last* one
    // registered wins a match. Register `rules/preview` before `rules/*` and
    // the wildcard swallows the preview POST — the editor then reads `matched`
    // off an unrelated body and renders "NaN records match".
    await page.route('**/api/alarms/rules', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
            const body = (request.postDataJSON() ?? {}) as Record<
                string,
                unknown
            >;
            recorder.creates.push(body);
            // The create response carries the first scan's result, which is
            // what lets the toast say what the alarm actually found rather
            // than "created".
            await route.fulfill(
                json({
                    rule: { ...rules[0], ...body },
                    scan: {
                        ruleId: rules[0].id,
                        scanned: previewTotal,
                        opened: previewMatched,
                        resolved: 0,
                        open: previewMatched
                    }
                })
            );
            return;
        }
        await route.fulfill(json(rules));
    });

    await page.route('**/api/alarms/rules/*', async (route) => {
        const request = route.request();
        if (request.method() === 'PATCH') {
            recorder.updates.push(
                (request.postDataJSON() ?? {}) as Record<string, unknown>
            );
            await route.fulfill(json(rules[0]));
            return;
        }
        await route.fulfill(json({ ok: true }));
    });

    await page.route('**/api/alarms/rules/preview', async (route) => {
        await route.fulfill(
            json({
                matched: previewMatched,
                total: previewTotal,
                sampleIds: []
            })
        );
    });

    await page.route('**/api/alarms/findings*', async (route) => {
        const url = new URL(route.request().url());
        const state = url.searchParams.get('state');
        const visible = state
            ? findings.filter((finding) => finding.state === state)
            : findings;
        await route.fulfill(
            json({
                items: visible,
                total: visible.length,
                page: 1,
                pageSize: 25
            })
        );
    });

    await page.route('**/api/alarms/findings/by-entry*', async (route) => {
        await route.fulfill(json({ items: {} }));
    });

    await page.route('**/api/alarms/findings/summary*', async (route) => {
        const open = findings.filter((f) => f.state === 'open');
        await route.fulfill(
            json({
                open: { error: open.length, warn: 0, info: 0 },
                openTotal: open.length
            })
        );
    });

    return recorder;
}
