import { SessionPolicy } from '../../domain/session-policy';
import type {
    ResolvedSession,
    SessionRepository
} from '../../domain/session.repository';
import { RefreshSessionUseCase } from './refresh-session.use-case';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'f'.repeat(64);

/**
 * `RefreshSessionUseCase` — the authenticated-request hot path. Two invariants
 * meet here: a token that resolves to nothing yields nothing (И-02, the status
 * check that repeats on every request lives behind `resolveActive`), and a read
 * must not silently become a write on every hit — `lastUsedAt` is refreshed at
 * most once per throttle window, and the {@link SessionPolicy} is the one place
 * that decides.
 *
 * Driven over a test double for the repository and the *real* policy: the
 * throttle is pure domain arithmetic, so stubbing it would test the stub.
 */
describe('RefreshSessionUseCase', () => {
    interface Harness {
        useCase: RefreshSessionUseCase;
        /** Every `touchLastUsed` call, in order. */
        touches: { token: string; at: Date }[];
        /** Every token handed to `resolveActive`, in order. */
        lookups: string[];
    }

    function harness(resolved: ResolvedSession | null): Harness {
        const touches: Harness['touches'] = [];
        const lookups: string[] = [];

        const sessions = {
            resolveActive: async (token: string) => {
                lookups.push(token);
                return resolved;
            },
            touchLastUsed: async (token: string, at: Date) => {
                touches.push({ token, at });
            }
        } as unknown as SessionRepository;

        return {
            useCase: new RefreshSessionUseCase(
                new SessionPolicy(3600),
                sessions
            ),
            touches,
            lookups
        };
    }

    /** A session last seen `ms` milliseconds ago. */
    function lastSeen(ms: number): ResolvedSession {
        return { userId: USER_ID, lastUsedAt: new Date(Date.now() - ms) };
    }

    it('resolves an unknown token to nothing, writing nothing', async () => {
        // Unknown, revoked, and expired all arrive here as the same `null`, and
        // none of them may leave a write behind.
        const { useCase, touches, lookups } = harness(null);

        await expect(useCase.execute(TOKEN)).resolves.toBeNull();
        expect(lookups).toEqual([TOKEN]);
        expect(touches).toEqual([]);
    });

    it('refreshes lastUsedAt once when the throttle window has elapsed', async () => {
        const before = Date.now();
        const { useCase, touches } = harness(lastSeen(5 * 60_000));

        await expect(useCase.execute(TOKEN)).resolves.toEqual({
            userId: USER_ID
        });

        expect(touches).toHaveLength(1);
        expect(touches[0].token).toBe(TOKEN);
        expect(touches[0].at.getTime()).toBeGreaterThanOrEqual(before);
        expect(touches[0].at.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('leaves a recently-used session untouched but still resolves it', async () => {
        // The point of the throttle: an authenticated GET ten seconds after the
        // last one is a read, and stays a read.
        const { useCase, touches } = harness(lastSeen(10_000));

        await expect(useCase.execute(TOKEN)).resolves.toEqual({
            userId: USER_ID
        });
        expect(touches).toEqual([]);
    });
});
