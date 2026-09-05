import { Session, type SessionState } from './session';

const NOW = new Date('2026-01-01T00:00:00.000Z');

/** A loaded session, active at {@link NOW} unless the test says otherwise. */
function rehydrated(overrides: Partial<SessionState> = {}): Session {
    return Session.rehydrate({
        userId: '11111111-1111-4111-8111-111111111111',
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        revokedAt: null,
        lastUsedAt: NOW,
        ...overrides
    });
}

/**
 * `isActiveAt`: a session is usable only while it is neither revoked nor
 * expired, re-decided on every request rather than at sign-in. It mirrors the adapter's `revoked_at IS NULL AND expires_at > now`
 * predicate, so the two must agree on the edges — revocation beating a future
 * expiry, and an expiry that has exactly arrived.
 *
 * Read once as the domain half of the identity dossier's I-02 and left uncited:
 * I-02 is about the *account* status being re-checked on every request, and
 * this class never sees a status. It is pinned in
 * `apps/server-e2e/src/server/auth/me.spec.ts`.
 */
describe('Session', () => {
    describe('isActiveAt', () => {
        it('is active while unrevoked and not yet expired', () => {
            expect(rehydrated().isActiveAt(NOW)).toBe(true);
        });

        it('is inactive once revoked, even with a future expiry', () => {
            const session = rehydrated({
                revokedAt: new Date(NOW.getTime() - 1_000)
            });
            expect(session.isRevoked).toBe(true);
            expect(session.isActiveAt(NOW)).toBe(false);
        });

        it('is inactive at the exact moment of expiry', () => {
            const session = rehydrated({ expiresAt: NOW });
            expect(session.isActiveAt(NOW)).toBe(false);
        });

        it('is inactive once the expiry has passed', () => {
            const session = rehydrated({
                expiresAt: new Date(NOW.getTime() - 1)
            });
            expect(session.isActiveAt(NOW)).toBe(false);
        });

        it('is still active one millisecond before expiry', () => {
            const session = rehydrated({
                expiresAt: new Date(NOW.getTime() + 1)
            });
            expect(session.isActiveAt(NOW)).toBe(true);
        });
    });
});
