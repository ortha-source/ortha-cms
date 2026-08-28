import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ROOT_EMAIL = 'sso-timing-root@example.com';
const ORDINARY_EMAIL = 'sso-timing-member@example.com';
const PASSWORD = 'SecurePass123!';
const WRONG_PASSWORD = 'NotThePassword123!';

/**
 * With passwords turned off, the response time must not point at the one
 * address that still has one.
 *
 * `allowPasswordLogin: false` is for a deployment where the identity provider
 * is the only way in — except for the root administrator, who keeps a password
 * path because the alternative has no recovery. That exemption is a **single
 * named address with a live credential on a login form the whole internet can
 * reach**, so finding it is worth real effort to an attacker, and the CMS has
 * no other clue to give: every rejection is the same `401`.
 *
 * The obvious implementation leaks it anyway. Refusing a non-root address is a
 * string comparison against config — nanoseconds — while the root's own attempt
 * runs bcrypt at cost 12. A few dozen guesses against a stopwatch would then
 * name the break-glass account. `LoginUseCase` closes it by running one
 * comparison against a throwaway hash on the refusal path too.
 *
 * The measurement is built the same way as `login-timing.spec.ts`: interleaved
 * samples, medians rather than means, a discarded warm-up (the throwaway hash
 * is minted lazily on first use), a 50% band, and an absolute floor so that
 * "both instant" cannot pass as "indistinguishable". See that file for the
 * reasoning in full.
 */
describe('POST /api/auth/login with passwords off — timing hides the break-glass address', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp({
            sso: { allowPasswordLogin: false },
            rootAdmin: { email: ROOT_EMAIL, password: PASSWORD, name: 'Root' }
        });
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        // `resetDb` truncates `users`, so the bootstrapped root admin is gone —
        // re-seeded here, as the passwords-off suite does.
        await seedActiveUser(harness.app, {
            email: ROOT_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        await seedActiveUser(harness.app, {
            email: ORDINARY_EMAIL,
            password: PASSWORD,
            role: 'contributor'
        });
    });

    /** One rejected sign-in, timed in milliseconds. Asserts the 401 too. */
    async function timeRejection(email: string): Promise<number> {
        const started = process.hrtime.bigint();
        await request(harness.server)
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email, password: WRONG_PASSWORD })
            .expect(401);
        return Number(process.hrtime.bigint() - started) / 1_000_000;
    }

    function median(samples: number[]): number {
        const sorted = [...samples].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    it('refuses an ordinary account as slowly as it refuses the root admin', async () => {
        // Warm-up, discarded: the refusal path mints its throwaway hash on
        // first use, so the very first sample pays for a bcrypt hash on top
        // of its comparison.
        await timeRejection(ORDINARY_EMAIL);
        await timeRejection(ROOT_EMAIL);

        const refused: number[] = [];
        const rootAttempt: number[] = [];
        for (let round = 0; round < 9; round += 1) {
            refused.push(await timeRejection(ORDINARY_EMAIL));
            rootAttempt.push(await timeRejection(ROOT_EMAIL));
        }

        const a = median(refused);
        const b = median(rootAttempt);
        const slower = Math.max(a, b);
        const faster = Math.min(a, b);

        // Both branches ran a bcrypt comparison…
        expect(faster).toBeGreaterThan(40);
        // …and neither is meaningfully quicker than the other, so a
        // stopwatch cannot separate the exempt address from any other.
        expect(slower).toBeLessThan(faster * 1.5);
    }, 90_000);

    it('still refuses both, so the timing claim is about two rejections', async () => {
        // The control for the measurement above: if the root's correct password
        // were being accepted here the comparison would be between a rejection
        // and a sign-in, which is a different (and uninteresting) claim.
        await request(harness.server)
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email: ORDINARY_EMAIL, password: WRONG_PASSWORD })
            .expect(401);
        await request(harness.server)
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email: ROOT_EMAIL, password: WRONG_PASSWORD })
            .expect(401);

        // And the exemption itself is real: the right password still works for
        // the root address and still does not for anybody else.
        await request(harness.server)
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email: ROOT_EMAIL, password: PASSWORD })
            .expect(201);
        await request(harness.server)
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email: ORDINARY_EMAIL, password: PASSWORD })
            .expect(401);
    });
});
