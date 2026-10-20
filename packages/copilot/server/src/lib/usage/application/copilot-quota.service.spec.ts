import {
    COPILOT_LIMIT_CODES,
    type CopilotQuotas,
    type UsageSnapshot
} from '@orthacms/copilot-domain';
import type { RateLimiter } from '@orthacms/identity-server';
import type { CopilotPluginConfig } from '../../types/copilot-config';
import type {
    UsageRepository,
    UsageWindow
} from '../infrastructure/persistence/usage.repository';
import { CopilotLimitError } from './copilot-limit.error';
import { CopilotQuotaService } from './copilot-quota.service';

const NOW = new Date('2026-10-19T15:00:00.000Z');
const REQUESTER = { userId: 'user-1', workspaceId: 'workspace-1' };

/**
 * The ledger's locking and SQL are the e2e suite's to prove against a real
 * Postgres. What is pinned here is the decision around them: which limits are
 * consulted, in what order, what a refusal carries, and what budget an
 * admitted run leaves with.
 */
function service(
    quotas: CopilotQuotas | undefined,
    options: {
        snapshot?: Partial<UsageSnapshot>;
        rate?: { allowed: boolean; retryAfterMs: number };
        spent?: { user: number; workspace: number };
        limits?: CopilotPluginConfig['limits'];
        permissionDecisionBudgetMs?: number;
    } = {}
) {
    const snapshot: UsageSnapshot = {
        activeRuns: 0,
        userTokensToday: 0,
        workspaceTokensToday: 0,
        ...options.snapshot
    };
    const windows: (UsageWindow | null)[] = [];
    const ledger = {
        open: jest.fn(
            async (
                _key: unknown,
                _at: Date,
                window: UsageWindow | null,
                decide: (s: UsageSnapshot) => unknown
            ) => {
                windows.push(window);
                const looked = window
                    ? snapshot
                    : {
                          activeRuns: 0,
                          userTokensToday: 0,
                          workspaceTokensToday: 0
                      };
                return { snapshot: looked, refusal: decide(looked) };
            }
        ),
        spentSince: jest.fn(
            async () => options.spent ?? { user: 0, workspace: 0 }
        )
    };
    const rateLimiter = {
        consume: jest.fn(
            async () => options.rate ?? { allowed: true, retryAfterMs: 0 }
        )
    };
    const config: CopilotPluginConfig = {
        enabled: true,
        maxOutputTokens: 1024,
        ...(quotas ? { quotas } : {}),
        ...(options.limits ? { limits: options.limits } : {}),
        ...(options.permissionDecisionBudgetMs
            ? { permissionDecisionBudgetMs: options.permissionDecisionBudgetMs }
            : {})
    };
    return {
        quotaService: new CopilotQuotaService(
            config,
            ledger as unknown as UsageRepository,
            rateLimiter as unknown as RateLimiter
        ),
        ledger,
        rateLimiter,
        windows
    };
}

async function refusal(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        if (error instanceof CopilotLimitError) return error.refusal;
        throw error;
    }
    throw new Error('expected the run to be refused');
}

describe('CopilotQuotaService.begin', () => {
    // A deployment that set nothing must not pay for a lock or a read on
    // every run — only the row it would have written anyway.
    it('admits without reading or locking when no limit is set', async () => {
        const { quotaService, rateLimiter, windows } = service(undefined);

        const meter = await quotaService.begin(REQUESTER, NOW);

        expect(windows).toEqual([null]);
        expect(rateLimiter.consume).not.toHaveBeenCalled();
        expect(meter.budget).toBe(Infinity);
    });

    // Spend is recorded either way, so a quota switched on later sees today.
    it('writes the run’s row even with no limit set [copilot:I-45]', async () => {
        const { quotaService, ledger } = service(undefined);

        const meter = await quotaService.begin(REQUESTER, NOW);

        expect(ledger.open).toHaveBeenCalledWith(
            { runId: meter.runId, ...REQUESTER },
            NOW,
            null,
            expect.any(Function)
        );
    });

    it('counts runs per minute against the user, not the address [copilot:I-49]', async () => {
        const { quotaService, rateLimiter } = service({ runsPerMinute: 5 });

        await quotaService.begin(REQUESTER, NOW);

        expect(rateLimiter.consume).toHaveBeenCalledWith(
            'copilot:runs:user-1',
            {
                limit: 5,
                windowMs: 60_000
            }
        );
    });

    // Cheapest first, and a refused hit must not leave a ledger row behind.
    it('refuses on the rate limit before touching the ledger [copilot:I-44]', async () => {
        const { quotaService, ledger } = service(
            { runsPerMinute: 5, userDailyTokens: 1000 },
            { rate: { allowed: false, retryAfterMs: 12_000 } }
        );

        await expect(
            refusal(quotaService.begin(REQUESTER, NOW))
        ).resolves.toEqual({
            code: COPILOT_LIMIT_CODES.RATE_LIMITED,
            scope: 'user',
            retryAfterMs: 12_000
        });
        expect(ledger.open).not.toHaveBeenCalled();
    });

    it('refuses a spent quota with when it resets [copilot:I-44]', async () => {
        const { quotaService } = service(
            { userDailyTokens: 1000 },
            { snapshot: { userTokensToday: 1000 } }
        );

        await expect(
            refusal(quotaService.begin(REQUESTER, NOW))
        ).resolves.toEqual({
            code: COPILOT_LIMIT_CODES.QUOTA_EXCEEDED,
            scope: 'user',
            resetsAt: new Date('2026-10-20T00:00:00.000Z')
        });
    });

    it('reads today’s spend from midnight UTC', async () => {
        const { quotaService, windows } = service({ userDailyTokens: 1000 });

        await quotaService.begin(REQUESTER, NOW);

        expect(windows[0]?.dayStart).toEqual(
            new Date('2026-10-19T00:00:00.000Z')
        );
    });

    // A run can live its whole wall clock plus a permission wait without
    // writing its row; only past that (and a grace) is it a crashed orphan.
    it('treats a running row as an orphan only past the longest a run can live', async () => {
        const { quotaService, windows } = service(
            { maxConcurrentRuns: 1 },
            {
                limits: { wallClockMs: 120_000 },
                permissionDecisionBudgetMs: 180_000
            }
        );

        await quotaService.begin(REQUESTER, NOW);

        expect(windows[0]?.liveSince).toEqual(
            new Date(NOW.getTime() - 120_000 - 180_000 - 60_000)
        );
    });

    it('leaves an admitted run the smaller of the two remainders', async () => {
        const { quotaService } = service(
            { userDailyTokens: 1000, workspaceDailyTokens: 10_000 },
            { snapshot: { userTokensToday: 200, workspaceTokensToday: 9_900 } }
        );

        const meter = await quotaService.begin(REQUESTER, NOW);

        expect(meter.budget).toBe(100);
    });
});

describe('CopilotQuotaService.summary', () => {
    it('reports the user’s figures and the workspace only as a flag [copilot:I-50]', async () => {
        const { quotaService } = service(
            { userDailyTokens: 2_000_000, workspaceDailyTokens: 5_000_000 },
            { spent: { user: 1_240_000, workspace: 5_000_000 } }
        );

        await expect(quotaService.summary(REQUESTER, NOW)).resolves.toEqual({
            day: '2026-10-19',
            resetsAt: new Date('2026-10-20T00:00:00.000Z'),
            user: { used: 1_240_000, limit: 2_000_000 },
            workspace: { exhausted: true }
        });
    });

    it('says there is no quota rather than inventing one', async () => {
        const { quotaService } = service(undefined, {
            spent: { user: 500, workspace: 9_000 }
        });

        await expect(quotaService.summary(REQUESTER, NOW)).resolves.toEqual(
            expect.objectContaining({
                user: { used: 500, limit: null },
                workspace: { exhausted: false }
            })
        );
    });
});
