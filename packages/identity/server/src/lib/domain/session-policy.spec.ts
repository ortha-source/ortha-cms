import { SessionPolicy } from './session-policy';

describe('SessionPolicy', () => {
    describe('expiresAt', () => {
        it('adds the configured TTL to now', () => {
            const policy = new SessionPolicy(3600);
            const now = new Date('2026-01-01T00:00:00.000Z');
            expect(policy.expiresAt(now).toISOString()).toBe(
                '2026-01-01T01:00:00.000Z'
            );
        });
    });

    describe('shouldRefreshLastUsed', () => {
        const policy = new SessionPolicy(3600, 60_000);
        const now = new Date('2026-01-01T00:10:00.000Z');

        it('refreshes once the throttle window has elapsed', () => {
            const lastUsed = new Date(now.getTime() - 61_000);
            expect(policy.shouldRefreshLastUsed(lastUsed, now)).toBe(true);
        });

        it('does not refresh within the throttle window', () => {
            const lastUsed = new Date(now.getTime() - 59_000);
            expect(policy.shouldRefreshLastUsed(lastUsed, now)).toBe(false);
        });

        it('does not refresh exactly at the window boundary', () => {
            const lastUsed = new Date(now.getTime() - 60_000);
            expect(policy.shouldRefreshLastUsed(lastUsed, now)).toBe(false);
        });
    });
});
