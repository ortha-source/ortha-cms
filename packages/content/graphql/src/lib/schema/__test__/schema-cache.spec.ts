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
});
