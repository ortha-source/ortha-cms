import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser, seedUser } from '../../support/seed';

const EMAIL = 'timing-known@example.com';
const PENDING_EMAIL = 'timing-pending@example.com';
const PASSWORD = 'SecurePass123!';
const WRONG_PASSWORD = 'NotThePassword123!';

/**
 * How long the response takes must not say which accounts exist.
 *
 * The body already refuses to: every rejection is the same `401 Invalid
 * credentials`. Timing is the channel that leaks anyway, and it leaks by
 * *omission* — the natural implementation looks up the account, finds nothing,
 * and returns. That path skips bcrypt, which is the only expensive thing a
 * login does, so "no such account" answers in a couple of milliseconds while
 * "wrong password" takes the full cost factor. A few hundred guesses against a
 * stopwatch then enumerate the directory.
 *
 * `LoginUseCase` closes it by verifying against a throwaway hash when there is
 * no stored one, so **every** rejection pays for exactly one comparison.
 *
 * ## Why this test is shaped the way it is
 *
 * Wall-clock timing under Jest, a shared Postgres container and a garbage
 * collector is noisy, so the measurement is built to be robust rather than
 * precise:
 *
 * - **Medians, not means.** One 900 ms outlier from a GC pause moves a mean of
 *   eleven samples by 80 ms; it moves the median by nothing.
 * - **Interleaved samples.** The two branches alternate, so a machine that
 *   slows down halfway through the run slows both halves equally instead of
 *   loading the difference onto whichever went second.
 * - **A warm-up that is discarded.** The dummy hash is computed lazily *once*,
 *   on the first rejection that needs it — so the very first "unknown account"
 *   request pays for a bcrypt **hash** on top of its comparison and is
 *   legitimately slower than every one after it.
 * - **A generous threshold.** The regression this guards against is a ~100×
 *   gap (one bcrypt against one indexed lookup), so the bar is set where noise
 *   cannot reach it: the two medians must be within 50% of each other. A test
 *   demanding 5% would fail on a busy laptop and teach everyone to ignore it.
 * - **An absolute floor as well.** Two branches that are equally *instant*
 *   would satisfy a ratio and mean the comparison had been dropped from both,
 *   so each median must also clear 40 ms — far below a cost-12 bcrypt on any
 *   machine, far above a lookup that skipped one.
 */
describe('POST /api/auth/login — timing carries no enumeration signal', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
            email: EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        // An invited account that has not set a credential yet: the row exists
        // and its `password_hash` is null, which is the other way the
        // comparison could quietly be skipped.
        await seedUser(harness.app, {
            email: PENDING_EMAIL,
            role: 'viewer',
            status: 'pending'
        });
    });

    /** One rejected sign-in, timed in milliseconds. Asserts the 401 too. */
    async function timeRejection(email: string): Promise<number> {
        const started = process.hrtime.bigint();
        await request(harness.server)
            .post('/api/auth/login')
            .send({ email, password: WRONG_PASSWORD })
            .expect(401);
        return Number(process.hrtime.bigint() - started) / 1_000_000;
    }

    /** The middle sample — immune to the outlier a GC pause produces. */
    function median(samples: number[]): number {
        const sorted = [...samples].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    /**
     * Interleaved medians for two rejection branches, after a discarded
     * warm-up. Interleaving is what keeps a machine that slows down mid-run
     * from being read as a difference between the branches.
     */
    async function compareBranches(
        emailA: string,
        emailB: string,
        rounds: number
    ): Promise<{ a: number; b: number }> {
        // Discarded: the first rejection with no stored hash also pays for the
        // one-off bcrypt *hash* that mints the throwaway comparison target.
        await timeRejection(emailA);
        await timeRejection(emailB);

        const a: number[] = [];
        const b: number[] = [];
        for (let round = 0; round < rounds; round += 1) {
            a.push(await timeRejection(emailA));
            b.push(await timeRejection(emailB));
        }
        return { a: median(a), b: median(b) };
    }

    /** The 50% band both comparisons are asserted inside. */
    function expectIndistinguishable(first: number, second: number): void {
        const slower = Math.max(first, second);
        const faster = Math.min(first, second);
        // Each branch must actually have run a bcrypt comparison — two equally
        // instant branches are indistinguishable and both wrong.
        expect(faster).toBeGreaterThan(40);
        expect(slower).toBeLessThan(faster * 1.5);
    }

    it('answers an unknown address in the same time as a wrong password [identity:I-03]', async () => {
        const { a: unknown, b: wrongPassword } = await compareBranches(
            'timing-nobody@example.com',
            EMAIL,
            11
        );

        expectIndistinguishable(unknown, wrongPassword);
    }, 90_000);

    it('answers an account with no credential in that same time', async () => {
        // A `pending` row is the shape an invite leaves behind. It has no
        // hash to compare against, so without the throwaway one this branch
        // would return instantly and identify every outstanding invite.
        const { a: pending, b: wrongPassword } = await compareBranches(
            PENDING_EMAIL,
            EMAIL,
            7
        );

        expectIndistinguishable(pending, wrongPassword);
    }, 90_000);
});
