import type { Page } from '@playwright/test';

/** One vote, as `GET /api/protection/entries/:type/:id` returns it. */
export type ApprovalSeed = {
    userId: string;
    decision: 'approved' | 'changes_requested';
    note?: string | null;
    revisionId?: string;
    revisionNumber?: number | null;
    isStale?: boolean;
    createdAt?: string;
};

/** One entry's review state, as the same route returns it. */
export type EntryReviewSeed = {
    protected?: boolean;
    required?: number;
    given?: number;
    stale?: number;
    changesRequested?: number;
    blocked?: boolean;
    bypassable?: boolean;
    headRevisionId?: string;
    headRevisionNumber?: number;
    callerWroteHead?: boolean;
    approvals?: ApprovalSeed[];
    request?: {
        id: string;
        requestedBy: string;
        note: string | null;
        revisionId: string;
        createdAt: string;
    } | null;
};

/** An unprotected type — the state every installation is in until a rule exists. */
export const UNPROTECTED: EntryReviewSeed = {
    protected: false,
    required: 0,
    given: 0,
    blocked: false,
    bypassable: false
};

/**
 * Serves one entry's review state, plus the vote routes.
 *
 * Every field has a default so a test states only what it is about; the
 * defaults describe a **protected, unreviewed** entry, because that is the
 * state the interface has the most to say about.
 */
export async function mockEntryReview(
    page: Page,
    seed: EntryReviewSeed = {}
): Promise<void> {
    const body = {
        protected: seed.protected ?? true,
        required: seed.required ?? 2,
        given: seed.given ?? 0,
        stale: seed.stale ?? 0,
        changesRequested: seed.changesRequested ?? 0,
        blocked: seed.blocked ?? true,
        bypassable: seed.bypassable ?? false,
        headRevisionId: seed.headRevisionId ?? 'rev-7',
        headRevisionNumber: seed.headRevisionNumber ?? 7,
        callerWroteHead: seed.callerWroteHead ?? false,
        approvals: (seed.approvals ?? []).map((vote) => ({
            userId: vote.userId,
            decision: vote.decision,
            note: vote.note ?? null,
            revisionId: vote.revisionId ?? 'rev-7',
            revisionNumber: vote.revisionNumber ?? 7,
            isStale: vote.isStale ?? false,
            createdAt: vote.createdAt ?? '2026-09-09T09:00:00.000Z'
        })),
        request: seed.request ?? null
    };

    await page.route('**/api/protection/entries/**', async (route) => {
        if (route.request().method() !== 'GET') {
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body)
        });
    });
}

/** One stored rule, as `GET /api/protection/rules` returns it. */
export type ProtectionRuleSeed = {
    id?: string;
    kind?: string;
    slug: string;
    enabled?: boolean;
    requiredApprovals?: number;
    requireOtherPerson?: boolean;
    countStaleApprovals?: boolean;
    adminBypass?: boolean;
    allowTokenPublish?: boolean;
};

/** What a captured `PUT /api/protection/rules/:kind/:slug` carried. */
export type CapturedRuleWrite = {
    /** The `:kind/:slug` the write addressed. */
    path: string;
    /** The body, as sent. */
    body: Record<string, unknown>;
};

/**
 * Serves the workspace's rule list and captures every write.
 *
 * The returned array is filled as the page saves, so a test can assert on
 * **what was sent** rather than only on what the screen did — which is the only
 * way to pin that the editor submits all six fields, since a partial body would
 * look identical in the browser and silently reset the rest server-side.
 */
export async function mockProtectionRules(
    page: Page,
    rules: ProtectionRuleSeed[] = [],
    { status = 200 }: { status?: number } = {}
): Promise<CapturedRuleWrite[]> {
    const writes: CapturedRuleWrite[] = [];
    const body = rules.map((rule) => ({
        id: rule.id ?? `rule-${rule.slug}`,
        kind: rule.kind ?? 'collection',
        slug: rule.slug,
        enabled: rule.enabled ?? true,
        requiredApprovals: rule.requiredApprovals ?? 2,
        requireOtherPerson: rule.requireOtherPerson ?? true,
        countStaleApprovals: rule.countStaleApprovals ?? false,
        adminBypass: rule.adminBypass ?? true,
        allowTokenPublish: rule.allowTokenPublish ?? false
    }));

    await page.route('**/api/protection/rules**', async (route) => {
        const request = route.request();
        if (request.method() === 'GET') {
            await route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify(status === 200 ? body : { message: 'no' })
            });
            return;
        }
        if (request.method() === 'PUT') {
            writes.push({
                path: new URL(request.url()).pathname.split('/rules/')[1] ?? '',
                body: request.postDataJSON() as Record<string, unknown>
            });
            await route.fulfill({ status: 200, body: '{}' });
            return;
        }
        await route.fulfill({ status: 204, body: '' });
    });

    return writes;
}
