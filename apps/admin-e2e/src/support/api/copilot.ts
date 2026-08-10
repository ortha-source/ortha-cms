import { type Page } from '@playwright/test';

/** A thread as `GET /api/copilot/conversations` returns it. */
export interface CopilotConversationView {
    id: string;
    title: string | null;
    surface: string;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}

/** One turn, as the transcript route serves it (the model port's blocks). */
interface PersistedMessage {
    id: string;
    runId: string;
    role: 'user' | 'assistant';
    content: unknown[];
    stopReason: string | null;
}

/** What a test can assert about the calls the app made. */
export interface CopilotSpy {
    /** Every `PATCH /conversations/:id` body, in order. */
    readonly patches: { id: string; body: Record<string, unknown> }[];
    /** Every `POST /runs` body, in order. */
    readonly runs: Record<string, unknown>[];
    /** The mock's current threads — mutated by PATCH, like the real table. */
    readonly conversations: CopilotConversationView[];
}

/**
 * Local **noon**, `days` calendar days ago.
 *
 * The rail buckets threads by calendar day, so a seed measured in elapsed hours
 * lands in a different group depending on what time the suite runs — "two hours
 * ago" is *yesterday* at 01:00. Anchoring each row to the middle of its own day
 * makes "today", "yesterday" and "previous 7 days" the same answer at every
 * clock time, without freezing the browser's own clock.
 */
function daysAgo(days: number): string {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    noon.setDate(noon.getDate() - days);
    return noon.toISOString();
}

/**
 * Threads dated **relative to today**, because a fixed ISO string would drift
 * into the wrong bucket the day after it was written and take the group
 * assertions with it.
 */
function seedConversations(): CopilotConversationView[] {
    const row = (
        id: string,
        title: string | null,
        days: number,
        archived = false
    ): CopilotConversationView => ({
        id,
        title,
        surface: 'chat',
        archived,
        createdAt: daysAgo(days),
        updatedAt: daysAgo(days)
    });

    return [
        row('c_summary', 'Which articles are missing a summary?', 0),
        row('c_pricing', 'Rewrite the pricing page intro', 0),
        // Untitled, so the filter's "an untitled thread matches nothing" rule
        // has something to drop.
        row('c_untitled', null, 1),
        row('c_translate', 'Translate the launch post into German', 3),
        row('c_bios', 'Audit author bios for broken links', 5),
        row('c_notes', 'Draft release notes for 2.4', 12),
        row('c_authors', 'Which entries have no author linked?', 40)
    ];
}

/**
 * The transcript of `c_summary`: prose, the call that changed something, then
 * the sentence written **after** the change.
 *
 * Shaped that way on purpose — it is the fixture the transcript-ordering
 * assertions read, and the bug they guard against was a change card rendering
 * below text that was written before it.
 */
const SUMMARY_TRANSCRIPT: PersistedMessage[] = [
    {
        id: 'm1',
        runId: 'r1',
        role: 'user',
        content: [{ type: 'text', text: 'Which articles have no summary?' }],
        stopReason: null
    },
    {
        id: 'm2',
        runId: 'r1',
        role: 'assistant',
        content: [
            { type: 'text', text: 'Checking the published articles.' },
            {
                type: 'tool_use',
                id: 'call_search',
                name: 'admin_content_search',
                input: { contentType: 'article' }
            }
        ],
        stopReason: null
    },
    {
        id: 'm3',
        runId: 'r1',
        role: 'user',
        content: [
            {
                type: 'tool_result',
                toolUseId: 'call_search',
                content: '3 results',
                isError: false
            }
        ],
        stopReason: null
    },
    {
        id: 'm4',
        runId: 'r1',
        role: 'assistant',
        content: [
            {
                type: 'text',
                text: 'Three have none. I wrote one for the most read.'
            },
            {
                type: 'tool_use',
                id: 'call_update',
                name: 'content_propose_update',
                input: { contentType: 'article', id: 'e42' }
            },
            { type: 'text', text: 'That change is saved and published.' }
        ],
        stopReason: 'end'
    },
    {
        id: 'm5',
        runId: 'r1',
        role: 'user',
        content: [
            {
                type: 'tool_result',
                toolUseId: 'call_update',
                content: 'Applied',
                isError: false
            }
        ],
        stopReason: null
    }
];

/** The change `c_summary` made — joined to its call by `toolCallId`. */
const SUMMARY_PROPOSALS = [
    {
        id: 'p_summary',
        toolCallId: 'call_update',
        toolName: 'content_propose_update',
        kind: 'content.entry.update',
        summary: 'Set a summary on “Designing for editors”',
        target: { contentType: 'article', id: 'e42' },
        changes: [
            {
                field: 'summary',
                label: 'Summary',
                before: '',
                after: 'What changes when you treat editing as the product.'
            }
        ],
        status: 'accepted',
        result: { entityId: 'e42' },
        error: null
    }
];

/** One SSE frame, as the run route writes it. */
const frame = (event: Record<string, unknown>) =>
    `data: ${JSON.stringify(event)}\n\n`;

/**
 * A scripted run: prose, a tool call, the change it made, then more prose.
 *
 * The **same shape** as the stored transcript above, so the live path and the
 * reopened path are asserted against one expectation.
 */
function runBody(conversationId: string): string {
    return [
        frame({ type: 'run-started', runId: 'r_live', conversationId }),
        frame({
            type: 'text-delta',
            text: 'Setting the summary on that article. '
        }),
        frame({
            type: 'tool-call',
            id: 'call_live',
            name: 'content_propose_update',
            input: { contentType: 'article', id: 'e42' }
        }),
        frame({
            type: 'tool-result',
            id: 'call_live',
            ok: true,
            summary: 'Applied',
            durationMs: 41
        }),
        frame({
            type: 'proposal',
            id: 'p_live',
            toolCallId: 'call_live',
            toolName: 'content_propose_update',
            kind: 'content.entry.update',
            summary: 'Set a summary on “Designing for editors”',
            target: { contentType: 'article', id: 'e42' },
            changes: [
                {
                    field: 'summary',
                    label: 'Summary',
                    before: '',
                    after: 'A short summary.'
                }
            ],
            status: 'accepted',
            entityId: 'e42'
        }),
        frame({ type: 'text-delta', text: 'Afterwards: the change is saved.' }),
        frame({ type: 'done', messageId: 'm_live', stopReason: 'end' })
    ].join('');
}

/** How the mock should behave, for the error and empty paths. */
export interface CopilotMockOptions {
    /** Start with no threads, for the rail's empty state. */
    empty?: boolean;
    /** Fail the thread list, for "error is not empty". */
    listStatus?: number;
    /** Fail `PATCH`, for the rename/archive failure paths. */
    patchStatus?: number;
    /** Fail the transcript fetch, for the thread-open error state. */
    detailStatus?: number;
    /** Models the picker offers. Two or more, or the picker hides itself. */
    models?: { provider: string; model: string }[];
    /** Hold the run open this long before answering. */
    runDelayMs?: number;
}

/**
 * Stubs every copilot endpoint the admin calls, and keeps the thread list in
 * memory so a `PATCH` is visible to the next `GET` — the front-end analog of the
 * server suite's table. Returns a spy for asserting what the app sent.
 *
 * **The run route is fulfilled as `text/event-stream`.** The package notes said
 * that could not be done and therefore that the chat was untestable here; it can
 * — the whole body arrives in one read, so what is lost is only the *progressive*
 * arrival of frames, not the transcript they produce. Everything about a
 * finished turn — its text, its steps, the change card, and crucially their
 * **order** — is assertable. Only "watch it type" is not.
 */
export async function mockCopilotApi(
    page: Page,
    options: CopilotMockOptions = {}
): Promise<CopilotSpy> {
    const spy: CopilotSpy = {
        patches: [],
        runs: [],
        conversations: options.empty ? [] : seedConversations()
    };

    const models = options.models ?? [
        { provider: 'anthropic', model: 'claude-sonnet-5' },
        { provider: 'anthropic', model: 'claude-opus-5' },
        { provider: 'openai', model: 'gpt-5.2' }
    ];

    const json = (body: unknown, status = 200) => ({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body)
    });

    await page.route('**/api/copilot/models', (route) =>
        route.fulfill(json({ items: models }))
    );

    await page.route('**/api/copilot/proposals*', (route) => {
        const id = new URL(route.request().url()).searchParams.get(
            'conversationId'
        );
        return route.fulfill(
            json({ items: id === 'c_summary' ? SUMMARY_PROPOSALS : [] })
        );
    });

    await page.route('**/api/copilot/runs', async (route) => {
        spy.runs.push(
            JSON.parse(route.request().postData() ?? '{}') as Record<
                string,
                unknown
            >
        );
        if (options.runDelayMs) {
            await new Promise((r) => setTimeout(r, options.runDelayMs));
        }
        // The thread the run creates, so the rail lists it afterwards — the
        // real server does the same, deriving a title from the first message.
        if (!spy.conversations.some((row) => row.id === 'c_new')) {
            const now = new Date().toISOString();
            spy.conversations.unshift({
                id: 'c_new',
                title: 'Set the summary please',
                surface: 'chat',
                archived: false,
                createdAt: now,
                updatedAt: now
            });
        }
        try {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: runBody('c_new')
            });
        } catch {
            // Stop cancels the `fetch` while a delayed run is still being held
            // open here, so by the time this resolves there is nothing left to
            // answer. That is the feature working, not a failure — and letting
            // it reject would surface as an unhandled rejection in the runner.
        }
    });

    // Registered before the list route, and the two patterns are deliberately
    // disjoint: Playwright matches the **last** registered route first, and a
    // glob `*` does not cross a `/` — so `conversations*` below sees the list
    // (with or without its query string) and never `conversations/:id`.
    await page.route('**/api/copilot/conversations/*', async (route) => {
        const id = new URL(route.request().url()).pathname.split('/').pop();
        const conversation = spy.conversations.find((row) => row.id === id);

        if (route.request().method() === 'PATCH') {
            const body = JSON.parse(
                route.request().postData() ?? '{}'
            ) as Record<string, unknown>;
            spy.patches.push({ id: id ?? '', body });
            if (options.patchStatus) {
                return route.fulfill(
                    json({ message: 'Nope' }, options.patchStatus)
                );
            }
            if (!conversation) {
                return route.fulfill(json({ message: 'Not found' }, 404));
            }
            if (typeof body.title === 'string') {
                conversation.title = body.title.trim();
            }
            if (typeof body.archived === 'boolean') {
                conversation.archived = body.archived;
            }
            return route.fulfill(json(conversation));
        }

        if (options.detailStatus) {
            return route.fulfill(
                json({ message: 'Gone' }, options.detailStatus)
            );
        }
        if (!conversation) {
            return route.fulfill(json({ message: 'Not found' }, 404));
        }
        return route.fulfill(
            json({
                conversation,
                messages: id === 'c_summary' ? SUMMARY_TRANSCRIPT : []
            })
        );
    });

    await page.route('**/api/copilot/conversations*', (route) => {
        if (options.listStatus) {
            return route.fulfill(json({ message: 'Boom' }, options.listStatus));
        }
        const archived =
            new URL(route.request().url()).searchParams.get('archived') ===
            'true';
        return route.fulfill(
            json({
                items: spy.conversations.filter(
                    (row) => row.archived === archived
                )
            })
        );
    });

    return spy;
}
