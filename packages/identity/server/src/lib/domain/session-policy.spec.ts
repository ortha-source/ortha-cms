import { SessionPolicy } from './session-policy';

describe('SessionPolicy', () => {
    const NOW = new Date('2026-01-01T00:00:00.000Z');

    describe('expiresAt', () => {
        it('adds the configured TTL to now', () => {
            const policy = new SessionPolicy(3600);
            const now = new Date('2026-01-01T00:00:00.000Z');
            expect(policy.expiresAt(now).toISOString()).toBe(
                '2026-01-01T01:00:00.000Z'
            );
        });

        /**
         * The override exists for SSO: a directory can disable someone the
         * moment after they signed in and the CMS never hears about it, so a
         * deployment may want those sessions to lapse sooner and re-check with
         * the provider. A non-positive value is a misconfiguration, and honouring
         * it would mint a session that is already expired — an instant sign-out
         * loop — so the configured TTL wins instead.
         */
        it('applies a positive per-session override', () => {
            const policy = new SessionPolicy(3600);
            expect(policy.expiresAt(NOW, 900).toISOString()).toBe(
                '2026-01-01T00:15:00.000Z'
            );
        });

        it('accepts an override longer than the configured TTL', () => {
            const policy = new SessionPolicy(3600);
            expect(policy.expiresAt(NOW, 7200).toISOString()).toBe(
                '2026-01-01T02:00:00.000Z'
            );
        });

        it.each([0, -1, -3600])(
            'ignores the non-positive override %p and falls back to the TTL',
            (override) => {
                const policy = new SessionPolicy(3600);
                expect(policy.expiresAt(NOW, override).toISOString()).toBe(
                    '2026-01-01T01:00:00.000Z'
                );
            }
        );

        it('falls back to the TTL when no override is given', () => {
            const policy = new SessionPolicy(3600);
            expect(policy.expiresAt(NOW, undefined).toISOString()).toBe(
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
