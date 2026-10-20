import type { CopilotUsage } from './useCopilotUsage';
import { usageMeterState } from './usageMeter';

const resetsAt = new Date('2026-10-20T00:00:00.000Z');

function usage(
    used: number,
    limit: number | null,
    workspaceExhausted = false
): CopilotUsage {
    return {
        day: '2026-10-19',
        resetsAt,
        user: { used, limit },
        workspace: { exhausted: workspaceExhausted }
    };
}

describe('usageMeterState', () => {
    it('draws nothing before the summary has loaded', () => {
        expect(usageMeterState(undefined)).toBeNull();
    });

    // A meter for a limit that does not exist is a number about nothing.
    it('draws nothing when no quota applies', () => {
        expect(usageMeterState(usage(9_000_000, null))).toBeNull();
    });

    it('is normal under 80%', () => {
        expect(usageMeterState(usage(1_240_000, 2_000_000))).toEqual({
            level: 'normal',
            scope: null,
            used: 1_240_000,
            limit: 2_000_000,
            remaining: 760_000,
            fraction: 0.62,
            resetsAt
        });
    });

    it('warns from 80%', () => {
        expect(usageMeterState(usage(1_600_000, 2_000_000))?.level).toBe(
            'warning'
        );
    });

    it('is exhausted once the quota is reached, not only past it', () => {
        expect(usageMeterState(usage(2_000_000, 2_000_000))).toEqual(
            expect.objectContaining({
                level: 'exhausted',
                scope: 'user',
                remaining: 0,
                fraction: 1
            })
        );
    });

    // A run can overshoot by one model call; the bar must not overflow.
    it('caps the bar at full when the spend overshot', () => {
        expect(usageMeterState(usage(2_100_000, 2_000_000))?.fraction).toBe(1);
    });

    // The next send would be refused either way, so it says so either way.
    it('is exhausted when the workspace’s quota is spent, even with room left', () => {
        expect(usageMeterState(usage(10, 2_000_000, true))).toEqual(
            expect.objectContaining({ level: 'exhausted', scope: 'workspace' })
        );
    });

    it('shows a spent workspace quota when the user has none of their own', () => {
        expect(usageMeterState(usage(10, null, true))).toEqual(
            expect.objectContaining({
                level: 'exhausted',
                scope: 'workspace',
                used: null,
                limit: null
            })
        );
    });
});
