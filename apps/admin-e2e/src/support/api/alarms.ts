import { type Page, type Route } from '@playwright/test';

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
        // A **date** path, and the only field type that offers "within the
        // last". Without one in the surface no browser can author a relative
        // window, and the editor's `relativeDates: true` serialisation is
        // unreachable from the UI — the two spellings of the same condition
        // (`within_last {n, unit}` and a frozen `gte <ISO>`) look identical on
        // screen and differ only in what Save sends.
        { path: 'updatedAt', label: 'Updated', type: 'date', group: [] },
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
        // `dir` is not optional on the wire: `list-locales.controller` sends
        // `dir ?? 'ltr'`, so every locale the real server returns carries one,
        // and `localePolicy.dirOf` reads it off the response. Omitting it here
        // made this seed claim a shape the server does not have — the sibling
        // i18n seed has always had it.
        { slug: 'en', name: 'English', isDefault: true, dir: 'ltr' },
        { slug: 'de', name: 'German', isDefault: false, dir: 'ltr' }
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
    /**
     * Fail `GET /alarms/rules`, so the page must say the request failed rather
     * than draw the empty state. "No alarms" and "could not ask" render as the
     * same blank page unless something tells them apart.
     */
    rulesFailing?: boolean;
    /** Fail `GET /alarms/findings`, for the same reason one group down. */
    findingsFailing?: boolean;
    /**
     * Findings for the entry batch, keyed by entry id — what the entry rail's
     * Checks block and the records list's Checks column both read.
     */
    byEntry?: Record<string, AlarmFindingSeed[]>;
    /** Fail the batch: "we could not check" must not read as "nothing flagged". */
    byEntryFailing?: boolean;
    /** Hold the batch open, so the loading state of both surfaces is observable. */
    byEntryDelayMs?: number;
    /**
     * Per-workspace overrides, selected by the `X-Workspace-Id` header the
     * shared `apiClient` attaches.
     *
     * This is what makes the cache-key rule observable: with the workspace id
     * missing from the key, opening a second workspace serves the first one's
     * rules out of cache with no pending state at all, and `delayMs` is what
     * holds that difference still long enough to assert on.
     */
    perWorkspace?: Record<
        string,
        {
            rules?: AlarmRuleSeed[];
            findings?: AlarmFindingSeed[];
            delayMs?: number;
        }
    >;
}

/** Every PATCH body the editor sent, in order. Reset per `mockAlarmsApi` call. */
export interface AlarmsApiRecorder {
    /** Bodies of `POST /api/alarms/rules`. */
    creates: Record<string, unknown>[];
    /** Bodies of `PATCH /api/alarms/rules/:id`. */
    updates: Record<string, unknown>[];
    /** Rule ids passed to `POST /api/alarms/rules/:id/rescan`. */
    rescans: string[];
    /**
     * The `entryIds` parameter of every `GET /alarms/findings/by-entry`.
     *
     * A count of zero is the assertion the hidden Checks column needs, and it
     * has to be recorded in the mock rather than by a `page.on('request')`
     * listener: the listener only sees requests the browser actually makes,
     * which is the same thing, but a recorder that lives with the route also
     * survives a spec forgetting to register the listener before navigating.
     */
    byEntryRequests: string[];
}

/**
 * Stub the whole `/api/alarms` surface plus the content filter-fields route the
 * rule editor's query builder reads.
 *
 * Returns a recorder so a suite can assert **what the editor sent**, not only
 * what it drew. That distinction is the whole point here: the condition editor
 * looked correct while saving the rule's previous filter, and no assertion
 * about the screen would have caught it.
 *
 * A suite that already owns the content mocks — anything driving the Content
 * Library, where alarms reaches through three slots — wants
 * {@link mockAlarmsSlots} instead: this one claims `/api/content-schema` too,
 * and the last route registered wins.
 */
export async function mockAlarmsApi(
    page: Page,
    options: AlarmsApiOptions = {}
): Promise<AlarmsApiRecorder> {
    const { filterFieldsDelayMs = 0, filterFieldsFailing = false } = options;

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

    return mockAlarmsSlots(page, options);
}

/**
 * Stub **only** `/api/alarms/**`, leaving every content route to whoever else
 * registered one.
 *
 * This is the half a Content Library suite needs. Alarms reaches editors
 * through three of content's slots — the entry rail's Checks block, the
 * optional records column, and "Save as alarm" in the records toolbar — and
 * all three run against the *content* suite's schemas and rows, not the single
 * `test_article` {@link mockAlarmsApi} invents.
 */
export async function mockAlarmsSlots(
    page: Page,
    options: AlarmsApiOptions = {}
): Promise<AlarmsApiRecorder> {
    const {
        rules = [CONTAINS_RULE],
        findings = [OPEN_FINDING],
        previewMatched = 3,
        previewTotal = 312,
        rulesFailing = false,
        findingsFailing = false,
        byEntry = {},
        byEntryFailing = false,
        byEntryDelayMs = 0,
        perWorkspace
    } = options;

    const recorder: AlarmsApiRecorder = {
        creates: [],
        updates: [],
        rescans: [],
        byEntryRequests: []
    };

    /** The 500 every "the request failed" option answers with. */
    const fail = (route: Route) =>
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'nope' })
        });

    /**
     * The seed for the workspace this request is scoped to.
     *
     * `apiClient` attaches `X-Workspace-Id` on every call, which is the same
     * header the server's `WorkspaceGuard` reads — so keying the mock on it
     * makes the mock disagree between workspaces exactly where the server
     * would, and a cache key that dropped the workspace id shows up as one
     * workspace's rules on the other's page.
     */
    const seedFor = (route: Route) => {
        const id = route.request().headers()['x-workspace-id'] ?? '';
        const override = perWorkspace?.[id];
        return {
            rules: override?.rules ?? rules,
            findings: override?.findings ?? findings,
            delayMs: override?.delayMs ?? 0
        };
    };

    const wait = (ms: number) =>
        ms > 0
            ? new Promise((resolve) => setTimeout(resolve, ms))
            : Promise.resolve();

    // **Registered general-first, specific-last, deliberately.** Playwright
    // checks routes in reverse registration order, so the *last* one
    // registered wins a match. Register `rules/preview` before `rules/*` and
    // the wildcard swallows the preview POST — the editor then reads `matched`
    // off an unrelated body and renders "NaN records match".
    await page.route('**/api/alarms/rules', async (route) => {
        const request = route.request();
        const seed = seedFor(route);
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
                    rule: { ...seed.rules[0], ...body },
                    scan: {
                        ruleId: seed.rules[0]?.id ?? 'rule-1',
                        scanned: previewTotal,
                        opened: previewMatched,
                        resolved: 0,
                        open: previewMatched
                    }
                })
            );
            return;
        }
        await wait(seed.delayMs);
        if (rulesFailing) return fail(route);
        await route.fulfill(json(seed.rules));
    });

    // Order-independent, unlike `rules/preview`: a `*` segment does not cross
    // `/`, so `rules/*` cannot match this two-segment path however it is
    // registered.
    await page.route('**/api/alarms/rules/*/rescan', async (route) => {
        const parts = new URL(route.request().url()).pathname.split('/');
        recorder.rescans.push(parts[parts.length - 2] ?? '');
        await route.fulfill(
            json({
                ruleId: rules[0].id,
                scanned: previewTotal,
                opened: 0,
                resolved: 0,
                open: previewMatched
            })
        );
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

    // Paged and filtered the way the server pages and filters, because the
    // group header's count is *not* read from here: a mock that answered every
    // seeded finding whatever the page asked for could not tell a header built
    // from the alarm's own `openCount` from one counting the rows below it.
    await page.route('**/api/alarms/findings*', async (route) => {
        const url = new URL(route.request().url());
        const seed = seedFor(route);
        await wait(seed.delayMs);
        if (findingsFailing) return fail(route);
        const state = url.searchParams.get('state');
        const ruleId = url.searchParams.get('ruleId');
        const severity = url.searchParams.get('severity');
        const pageNum = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '25');
        const visible = seed.findings.filter(
            (finding) =>
                (!state || finding.state === state) &&
                (!ruleId || finding.ruleId === ruleId) &&
                (!severity || finding.severity === severity)
        );
        const start = (pageNum - 1) * pageSize;
        await route.fulfill(
            json({
                items: visible.slice(start, start + pageSize),
                total: visible.length,
                page: pageNum,
                pageSize
            })
        );
    });

    await page.route('**/api/alarms/findings/by-entry*', async (route) => {
        const url = new URL(route.request().url());
        recorder.byEntryRequests.push(url.searchParams.get('entryIds') ?? '');
        await wait(byEntryDelayMs);
        if (byEntryFailing) return fail(route);
        // `byEntry`, not `items`: `toFindingsByEntry` reads `dto.byEntry` and
        // falls back to `{}`, so the wrong envelope is an empty batch that
        // looks exactly like a clean workspace.
        await route.fulfill(json({ byEntry: byEntry }));
    });

    await page.route('**/api/alarms/findings/summary*', async (route) => {
        const seed = seedFor(route);
        await wait(seed.delayMs);
        const open = seed.findings.filter((f) => f.state === 'open');
        await route.fulfill(
            json({
                open: {
                    error: open.filter((f) => f.severity === 'error').length,
                    warn: open.filter((f) => f.severity === 'warn').length,
                    info: open.filter((f) => f.severity === 'info').length
                },
                openTotal: open.length
            })
        );
    });

    return recorder;
}
