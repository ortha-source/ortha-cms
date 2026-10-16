/**
 * Spread the seeded history over the last few months.
 *
 * Every service stamps `now()`, so straight out of the other phases the whole
 * database was written within a minute — and the Insights page (velocity,
 * punchcard, stale content, uploads over time) reads timestamps, so it would
 * show one spike. This moves each entry back by a stable number of days
 * derived from its id (the same entry lands on the same day every reset),
 * keeping the order of its own versions, and pushes one entry past a year so
 * the "stale" bucket has something in it.
 *
 * Raw SQL by necessity: no service writes a timestamp it was given.
 */
import { getTableName, sql } from 'drizzle-orm';
import { contentTypes } from '../../../src/content';
import type { SeedContext } from '../context';

/** Days back for a row: 3–120, stable per id. */
const offset = (id: string) =>
    sql.raw(`(3 + abs(hashtext(${id}::text)) % 118)`);

export async function seedBackdate(ctx: SeedContext): Promise<void> {
    const db = ctx.db;

    for (const type of contentTypes) {
        const table = sql.identifier(getTableName(type.table));
        await db.execute(sql`
            update ${table} set
                created_at = created_at - make_interval(days => ${offset('id')}),
                updated_at = updated_at - make_interval(days => ${offset('id')}) / 2
        `);
        if (type.publishable) {
            await db.execute(sql`
                update ${table}
                set published_at = published_at - make_interval(days => ${offset('id')}) * 3 / 4
                where published_at is not null
            `);
        }
    }

    // Versions move with their entry, by the same amount, so their order holds.
    await db.execute(sql`
        update content_entry_revisions set
            created_at = created_at - make_interval(days => ${offset('entry_id')}),
            published_at = published_at - make_interval(days => ${offset('entry_id')}) * 3 / 4
    `);

    const stale = ctx.entry('flags_pub_stale');
    await db.execute(sql`
        update content_flags_publishable
        set created_at = now() - interval '420 days', updated_at = now() - interval '400 days', published_at = now() - interval '400 days'
        where id = ${stale.id}
    `);
    await db.execute(sql`
        update content_entry_revisions
        set created_at = now() - interval '400 days', published_at = now() - interval '400 days'
        where entry_id = ${stale.id}
    `);

    await db.execute(sql`
        update media_asset set created_at = created_at - make_interval(days => ${offset('id')}) / 3
    `);
}
