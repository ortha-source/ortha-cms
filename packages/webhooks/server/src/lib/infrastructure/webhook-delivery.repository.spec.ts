import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
    WebhookDeliveryRepository,
    type AttemptOutcome
} from './webhook-delivery.repository';

/**
 * The fence is a `WHERE` clause, so it is asserted as one: what each
 * attempt-closing update would ask Postgres to match. Updating by `id` alone
 * let a worker whose claim had lapsed overwrite the state of the worker that
 * reclaimed the row, and count the attempt twice.
 */
describe('WebhookDeliveryRepository — writes fenced on the claim', () => {
    const claim = {
        id: 'delivery-1',
        claimedAt: new Date('2026-01-01T00:00:00.000Z')
    };
    const outcome: AttemptOutcome = {
        statusCode: 200,
        error: null,
        responseSnippet: 'ok',
        durationMs: 5
    };

    /** A database that records each update's predicate and matches `rows`. */
    function database(rows: unknown[]) {
        const dialect = new PgDialect();
        const predicates: { sql: string; params: unknown[] }[] = [];
        const db = {
            update: () => ({
                set: () => ({
                    where: (where: SQL) => {
                        predicates.push(dialect.sqlToQuery(where));
                        return { returning: async () => rows };
                    }
                })
            })
        };
        return {
            repository: new WebhookDeliveryRepository(db as never),
            predicates
        };
    }

    it.each([
        [
            'markSucceeded',
            (r: WebhookDeliveryRepository) => r.markSucceeded(claim, outcome)
        ],
        [
            'markDead',
            (r: WebhookDeliveryRepository) => r.markDead(claim, outcome)
        ],
        [
            'markRetrying',
            (r: WebhookDeliveryRepository) =>
                r.markRetrying(claim, outcome, new Date())
        ],
        ['renewClaim', (r: WebhookDeliveryRepository) => r.renewClaim(claim)]
    ])(
        '%s matches only a row still delivering under this claim',
        async (_name, write) => {
            const { repository, predicates } = database([{ id: claim.id }]);

            await write(repository);

            const [{ sql, params }] = predicates;
            expect(sql).toMatch(/"id" = \$\d/);
            expect(sql).toMatch(/"status" = \$\d/);
            expect(sql).toMatch(/"claimed_at" = \$\d/);
            expect(params).toEqual(
                expect.arrayContaining([
                    claim.id,
                    'delivering',
                    claim.claimedAt.toISOString()
                ])
            );
        }
    );

    it('reports a write that matched nothing, so the worker can say so', async () => {
        const { repository } = database([]);

        await expect(repository.markSucceeded(claim, outcome)).resolves.toBe(
            false
        );
        await expect(repository.renewClaim(claim)).resolves.toBeNull();
    });
});
