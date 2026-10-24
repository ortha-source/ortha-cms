import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Database } from '@orthacms/database';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';
import { ActivityService } from './services/activity.service';

/**
 * The free-text `?q=` search behind the Activity page's one search box —
 * "Search people, records, actions".
 *
 * Read the way `activity-filter.spec.ts` reads the actor search: the predicate
 * is rendered with Drizzle's own dialect, so what is asserted is the SQL and
 * the parameters Postgres would receive.
 */

/** Renders a Drizzle predicate the way the driver would send it. */
const render = (where: SQL) => new PgDialect().sqlToQuery(where);

/** Captures the `where` one `list(...)` call builds. */
async function whereFor(
    query: Partial<ListActivityQueryDto>
): Promise<SQL | undefined> {
    let captured: SQL | undefined;
    let seen = false;
    const db = {
        select() {
            let ordered = false;
            const builder = {
                from: () => builder,
                where(value: SQL | undefined) {
                    if (!seen) {
                        seen = true;
                        captured = value;
                    }
                    return builder;
                },
                orderBy: () => {
                    ordered = true;
                    return builder;
                },
                limit: () => builder,
                offset: () => builder,
                then: (resolve: (value: unknown) => unknown) =>
                    Promise.resolve(ordered ? [] : [{ total: 0 }]).then(resolve)
            };
            return builder;
        }
    };
    await new ActivityService(db as unknown as Database).list(
        query as ListActivityQueryDto
    );
    return captured;
}

describe('GET /api/activity — the free-text search [activity:I-40]', () => {
    it('matches the readable columns, and only those', async () => {
        const where = await whereFor({ q: 'spring' });
        if (!where) throw new Error('no predicate was built');
        const { sql, params } = render(where);

        for (const column of [
            '"actor_email"',
            '"subject_label"',
            '"subject_id"',
            '"subject_type"',
            '"kind"'
        ]) {
            expect(sql).toContain(column);
        }
        // `meta` is not a searchable column (`activity:I-16`) and neither is
        // the write time, which never reaches the wire.
        expect(sql).not.toContain('"meta"');
        expect(sql).not.toContain('"created_at"');
        // One clause, OR-ed inside.
        expect(sql).toContain(' or ');
        expect(params).toEqual(Array(5).fill('%spring%'));
    });

    it('reads spaces as the kind’s underscores, so "role changed" finds user.role_changed', async () => {
        const where = await whereFor({ q: 'role changed' });
        if (!where) throw new Error('no predicate was built');
        const { params } = render(where);

        // The underscore the search adds is escaped: it means the character,
        // not LIKE's single-character wildcard.
        expect(params).toContain('%role\\_changed%');
        expect(params).toContain('%role changed%');
    });

    it('escapes LIKE metacharacters in the needle [activity:I-19]', async () => {
        const where = await whereFor({ q: '50%_off' });
        if (!where) throw new Error('no predicate was built');
        const { params } = render(where);
        expect(params[0]).toBe('%50\\%\\_off%');
    });

    it('is AND-ed with every other filter [activity:I-15]', async () => {
        const where = await whereFor({
            q: 'grace',
            kind: ['user.suspended'],
            actorType: 'user'
        });
        if (!where) throw new Error('no predicate was built');
        const { sql } = render(where);

        expect(sql).toContain('"kind" in');
        expect(sql).toContain('"actor_type" =');
        // The search's OR is parenthesised inside the conjunction rather than
        // widening it — `a and b or c` would drop the other filters.
        expect(sql).toMatch(/ and \(.* or .*\)/);
    });

    it('adds nothing for an empty or blank search', async () => {
        expect(await whereFor({ q: '' })).toBeUndefined();
        expect(await whereFor({ q: '   ' })).toBeUndefined();
    });

    it('caps the needle at 255 characters, like the actor search', () => {
        const errors = (q: string) =>
            validateSync(plainToInstance(ListActivityQueryDto, { q })).filter(
                (error) => error.property === 'q'
            );
        expect(errors('x'.repeat(255))).toEqual([]);
        expect(errors('x'.repeat(256))).not.toEqual([]);
    });
});
