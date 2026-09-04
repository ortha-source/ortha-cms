import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { mediaAsset } from './media-asset';
import { mediaFolder } from './media-folder';

/**
 * The media plugin's founding decision, asserted against the two things that
 * can make it false: the Drizzle table definition, and the migration SQL that
 * actually reaches Postgres.
 *
 * Bytes belong to a `StorageProvider`; the row is a *pointer* — `storage_key`
 * (opaque, provider-owned) plus `storage_provider` (which backend holds it).
 * Everything else the plugin does rests on that. A `bytea` column would put
 * multi-megabyte blobs in every `SELECT *`, in every backup, in the WAL and in
 * the replicas, and would make `StorageProviderCheck`, the blob reclaim and the
 * whole adapter matrix decorative.
 *
 * Both halves are needed. Drizzle's `customType` can mint a `bytea` the schema
 * types happily accept, and a hand-written migration can add a column the
 * schema module never mentions — either one alone would leave the other's
 * route open.
 *
 * What this cannot catch is bytes smuggled through a *text* column as base64.
 * Nothing structural can; that is what review is for.
 */
describe('media_asset holds a pointer, not bytes', () => {
    /** Postgres' ways of storing a blob in a row, however the column is named. */
    const BINARY_TYPE = /\b(bytea|blob|bit|bit varying|varbit|oid|lo)\b/i;

    const TABLES = [
        ['media_asset', mediaAsset],
        ['media_folder', mediaFolder]
    ] as const;

    // covers: media:I-01
    it.each(TABLES)(
        'gives %s no column that can hold a blob',
        (_name, table) => {
            const binary = Object.values(getTableColumns(table))
                .map((column) => [column.name, column.getSQLType()] as const)
                .filter(([, sqlType]) => BINARY_TYPE.test(sqlType));

            expect(binary).toEqual([]);
        }
    );

    // covers: media:I-01
    it('points at the bytes with a storage key and the provider that holds them', () => {
        const columns = getTableColumns(mediaAsset);

        expect(columns.storageKey.name).toBe('storage_key');
        expect(columns.storageKey.getSQLType()).toBe('text');
        expect(columns.storageKey.notNull).toBe(true);

        expect(columns.storageProvider.name).toBe('storage_provider');
        expect(columns.storageProvider.getSQLType()).toBe('text');
        expect(columns.storageProvider.notNull).toBe(true);
    });

    describe('the committed migrations', () => {
        const DIR = join(__dirname, '../../../../migrations');
        const FILES = readdirSync(DIR)
            .filter((name) => name.endsWith('.sql'))
            .map(
                (name) => [name, readFileSync(join(DIR, name), 'utf8')] as const
            );

        it('found the migration SQL to read', () => {
            // A wrong path would make the case below pass over an empty list.
            expect(FILES.length).toBeGreaterThan(0);
            expect(
                FILES.some(([, sql]) =>
                    sql.includes('CREATE TABLE "media_asset"')
                )
            ).toBe(true);
        });

        // covers: media:I-01
        it('adds no binary column along the way', () => {
            const offenders = FILES.filter(([, sql]) =>
                sql
                    .split('\n')
                    // Only the column/type lines; a table named `blob_store`
                    // would otherwise read as a violation.
                    .some((line) =>
                        BINARY_TYPE.test(line.replace(/"[^"]*"/g, ''))
                    )
            ).map(([name]) => name);

            expect(offenders).toEqual([]);
        });
    });
});
