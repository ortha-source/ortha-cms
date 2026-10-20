import {
    admitRun,
    COPILOT_LIMIT_CODES,
    needsUsageSnapshot,
    remainingBudget,
    usageDay,
    type UsageSnapshot
} from './quota';

const day = usageDay(new Date('2026-10-19T15:30:00.000Z'));

function snapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
    return {
        activeRuns: 0,
        userTokensToday: 0,
        workspaceTokensToday: 0,
        ...overrides
    };
}

describe('usageDay', () => {
    it('opens at midnight UTC and closes at the next one', () => {
        expect(day.day).toBe('2026-10-19');
        expect(day.start.toISOString()).toBe('2026-10-19T00:00:00.000Z');
        expect(day.resetsAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    });

    // The zone the server runs in must not move the boundary, or two
    // instances in different regions would disagree about "today".
    it('reads the instant in UTC, whatever the offset it was written with', () => {
        expect(usageDay(new Date('2026-10-20T01:30:00+03:00')).day).toBe(
            '2026-10-19'
        );
    });
});

describe('needsUsageSnapshot', () => {
    it('is false when nothing would read it', () => {
        expect(needsUsageSnapshot({})).toBe(false);
        // A per-minute rate limit is counted in its own store.
        expect(needsUsageSnapshot({ runsPerMinute: 5 })).toBe(false);
    });

    it.each([
        { userDailyTokens: 1 },
        { workspaceDailyTokens: 1 },
        { maxConcurrentRuns: 1 }
    ])('is true for %o', (quotas) => {
        expect(needsUsageSnapshot(quotas)).toBe(true);
    });
});

describe('admitRun', () => {
    it('admits anything when no limit is set', () => {
        expect(
            admitRun(
                snapshot({
                    activeRuns: 50,
                    userTokensToday: 9e9,
                    workspaceTokensToday: 9e9
                }),
                {},
                day
            )
        ).toBeNull();
    });

    it('refuses a run past the concurrency cap', () => {
        expect(
            admitRun(snapshot({ activeRuns: 2 }), { maxConcurrentRuns: 2 }, day)
        ).toEqual({ code: COPILOT_LIMIT_CODES.TOO_MANY_RUNS, scope: 'user' });
    });

    it('admits a run under the concurrency cap', () => {
        expect(
            admitRun(snapshot({ activeRuns: 1 }), { maxConcurrentRuns: 2 }, day)
        ).toBeNull();
    });

    // The quota is spent when the spend reaches it, not only past it: a run
    // admitted with nothing left would be stopped before its first step.
    it('refuses a user whose quota is exactly spent, until midnight', () => {
        expect(
            admitRun(
                snapshot({ userTokensToday: 1000 }),
                { userDailyTokens: 1000 },
                day
            )
        ).toEqual({
            code: COPILOT_LIMIT_CODES.QUOTA_EXCEEDED,
            scope: 'user',
            resetsAt: day.resetsAt
        });
    });

    it('refuses everyone in a workspace whose quota is spent', () => {
        expect(
            admitRun(
                snapshot({ workspaceTokensToday: 5000 }),
                { userDailyTokens: 1000, workspaceDailyTokens: 5000 },
                day
            )
        ).toEqual(expect.objectContaining({ scope: 'workspace' }));
    });

    // Seconds to wait beats hours to wait: it is the one the person can act on.
    it('reports a run in flight before a spent quota', () => {
        expect(
            admitRun(
                snapshot({ activeRuns: 1, userTokensToday: 1000 }),
                { maxConcurrentRuns: 1, userDailyTokens: 1000 },
                day
            )?.code
        ).toBe(COPILOT_LIMIT_CODES.TOO_MANY_RUNS);
    });

    it('names the user’s own quota when both are spent', () => {
        expect(
            admitRun(
                snapshot({ userTokensToday: 10, workspaceTokensToday: 10 }),
                { userDailyTokens: 10, workspaceDailyTokens: 10 },
                day
            )?.scope
        ).toBe('user');
    });
});

describe('remainingBudget', () => {
    it('is unbounded with no quota', () => {
        expect(remainingBudget(snapshot(), {})).toBe(Infinity);
    });

    it('is the smaller of the two remainders', () => {
        expect(
            remainingBudget(
                snapshot({ userTokensToday: 300, workspaceTokensToday: 9500 }),
                { userDailyTokens: 1000, workspaceDailyTokens: 10_000 }
            )
        ).toBe(500);
    });

    it('never goes below zero', () => {
        expect(
            remainingBudget(snapshot({ userTokensToday: 1200 }), {
                userDailyTokens: 1000
            })
        ).toBe(0);
    });
});
