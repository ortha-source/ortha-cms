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
