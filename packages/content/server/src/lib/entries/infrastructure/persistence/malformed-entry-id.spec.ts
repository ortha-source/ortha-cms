import { NotFoundException } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import { PublicEntriesQuery } from '../../../public-api/infrastructure/public-entries.query';
import { DrizzleRevisionStore } from '../../../revisions/infrastructure/persistence/drizzle-revision.store';
import { EntryWriterService } from './entry-writer.service';

/**
 * An agent tool hands an entry id over exactly as the model wrote it — no
 * `ParseUUIDPipe` stands in front of a tool call — and `id = 'my-post'` on a
 * `uuid` column is a Postgres cast error, not a miss. That error used to reach
 * the model with the SQL in its message. A malformed id must instead read as
 * the same "not found" a missing entry gets, without being bound into a query.
 */

const article: AnyContentType = collection('malformed_id_article', {
    fields: { title: field.text() }
}) as AnyContentType;

const MALFORMED = 'my-post';
const MISSING = '0b9f2c64-7a51-4d3e-9c7b-5f1e2a3d4c6b';

/**
 * A database that answers every query with no rows, and remembers every value
 * a `where` would have bound — which is what Postgres would have tried to cast.
 */
function emptyDatabase() {
    const dialect = new PgDialect();
    const bound: unknown[] = [];
    const rows = (shape?: Record<string, unknown>) =>
        shape && 'total' in shape
            ? [{ total: 0 }]
            : shape && 'max' in shape
              ? [{ max: null }]
              : [];
    const chain = (shape?: Record<string, unknown>) => {
        const query: Record<string, unknown> = {};
        for (const method of ['from', 'orderBy', 'limit', 'offset']) {
            query[method] = () => query;
        }
        query['where'] = (where: SQL | undefined) => {
            if (where) bound.push(...dialect.sqlToQuery(where).params);
            return query;
        };
        query['then'] = (resolve: (value: unknown) => unknown) =>
            resolve(rows(shape));
        return query;
    };
    return {
        db: { select: (shape?: Record<string, unknown>) => chain(shape) },
        bound
    };
}

describe('a malformed entry id', () => {
    it('is the admin read’s ordinary not-found, never a bound uuid', async () => {
        const { db, bound } = emptyDatabase();
        const writer = new EntryWriterService(
            db as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never
        );

        const malformed = writer.getVisible(article, MALFORMED, 'ws');
        await expect(malformed).rejects.toBeInstanceOf(NotFoundException);
        await expect(malformed).rejects.toThrow(
            `No entry "${MALFORMED}" on content type "${article.name}".`
        );
        expect(bound).not.toContain(MALFORMED);

        // The same answer a well-formed id with no row gets.
        await expect(writer.getVisible(article, MISSING, 'ws')).rejects.toThrow(
            `No entry "${MISSING}" on content type "${article.name}".`
        );
    });

    it('is the public read’s ordinary not-found, never a bound uuid', async () => {
        const { db, bound } = emptyDatabase();
        const query = new PublicEntriesQuery(
            db as never,
            {} as never,
            {} as never
        );

        await expect(
            query.getOne(
                article,
                { id: MALFORMED },
                'ws',
                { status: 'any' } as never,
                new Set()
            )
        ).rejects.toThrow(
            `No published "${article.name}" entry with id "${MALFORMED}".`
        );
        expect(bound).not.toContain(MALFORMED);
    });

    it('has no timeline, like an unknown id', async () => {
        const { db, bound } = emptyDatabase();
        const store = new DrizzleRevisionStore(db as never);

        await expect(
            store.list(article.name, MALFORMED, 'ws', 1, 10)
        ).resolves.toEqual({ items: [], total: 0 });
        await expect(
            store.get(article.name, MALFORMED, 'ws', 1)
        ).resolves.toBeUndefined();
        expect(bound).not.toContain(MALFORMED);
    });
});
