import { SchemaCache } from '../schema-cache';
import {
    GRANTED_ALL,
    GRANTED_WITHOUT_VAULT,
    fixtureRegistry
} from './fixtures';

describe('SchemaCache', () => {
    it('reuses one schema for the same grant set', () => {
        const cache = new SchemaCache(fixtureRegistry(), 60_000);

        expect(cache.get(GRANTED_ALL)).toBe(cache.get(GRANTED_ALL));
    });

    it('keys on the grant set, not on identity', () => {
        // Two workspaces granted the same content share a schema — the key is
        // what they can see, not which workspace asked.
        const cache = new SchemaCache(fixtureRegistry(), 60_000);

        expect(cache.get(new Set(['article', 'tag', 'vault', 'landing']))).toBe(
            cache.get(new Set(['landing', 'vault', 'tag', 'article']))
        );
    });

    it('builds a different schema for a different grant set', () => {
        const cache = new SchemaCache(fixtureRegistry(), 60_000);

        expect(cache.get(GRANTED_ALL)).not.toBe(
            cache.get(GRANTED_WITHOUT_VAULT)
        );
    });

    it('rebuilds once the TTL has passed', () => {
        let now = 0;
        const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);
        const first = cache.get(GRANTED_ALL);

        now = 1001;

        expect(cache.get(GRANTED_ALL)).not.toBe(first);
    });

    it('holds the schema for the whole TTL', () => {
        let now = 0;
        const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);
        const first = cache.get(GRANTED_ALL);

        now = 999;

        expect(cache.get(GRANTED_ALL)).toBe(first);
    });

    it('drops everything on clear', () => {
        const cache = new SchemaCache(fixtureRegistry(), 60_000);
        const first = cache.get(GRANTED_ALL);

        cache.clear();

        expect(cache.get(GRANTED_ALL)).not.toBe(first);
    });

    // An expired entry was only ever *replaced*, by the same key being asked
    // for again — so the map held one schema per grant set the process had ever
    // served, not one per active workspace configuration. Editing a workspace's
    // grants mints a new key and orphans the old one, with a whole
    // `GraphQLSchema` attached.
    describe('eviction', () => {
        /** A grant set nothing else in the test will ask for again. */
        const orphan = (index: number) =>
            new Set(['article', `orphaned-${index}`]);

        it('sweeps expired entries once the map grows past the threshold', () => {
            let now = 0;
            const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);

            for (let index = 0; index < 40; index += 1) {
                cache.get(orphan(index));
            }
            expect(cache.size).toBe(40);

            // Every one of those is now stale, and none is ever asked for
            // again. The next build is what notices.
            now = 5000;
            cache.get(GRANTED_ALL);

            expect(cache.size).toBe(1);
        });

        it('keeps entries that are still live', () => {
            let now = 0;
            const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);

            for (let index = 0; index < 40; index += 1) {
                cache.get(orphan(index));
            }

            // Half the TTL in: nothing has expired, so the sweep must not
            // touch anything, and the entries still answer from cache.
            now = 500;
            const built = cache.get(GRANTED_ALL);

            expect(cache.size).toBe(41);
            expect(cache.get(GRANTED_ALL)).toBe(built);
        });

        it('leaves an ordinary deployment alone', () => {
            // A handful of grant sets never reaches the threshold, so the hot
            // path never walks the map — expired or not.
            let now = 0;
            const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);

            cache.get(GRANTED_ALL);
            cache.get(GRANTED_WITHOUT_VAULT);
            now = 5000;
            cache.get(GRANTED_ALL);

            expect(cache.size).toBe(2);
        });

        it('does not evict the entry it was called for', () => {
            let now = 0;
            const cache = new SchemaCache(fixtureRegistry(), 1000, () => now);

            for (let index = 0; index < 40; index += 1) {
                cache.get(orphan(index));
            }
            now = 5000;
            const built = cache.get(GRANTED_ALL);

            expect(cache.get(GRANTED_ALL)).toBe(built);
        });
    });
});
