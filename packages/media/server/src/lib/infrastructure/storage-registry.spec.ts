import type { StorageProvider } from '../domain/storage-provider';
import { buildRegistry } from './storage-registry';

const provider = {} as StorageProvider;

describe('buildRegistry', () => {
    it('returns a registered provider by name', () => {
        const registry = buildRegistry({ local: provider });

        expect(registry.has('local')).toBe(true);
        expect(registry.get('local')).toBe(provider);
        expect(registry.names()).toEqual(['local']);
    });

    it('throws for an unregistered name', () => {
        const registry = buildRegistry({ local: provider });

        expect(registry.has('s3')).toBe(false);
        expect(() => registry.get('s3')).toThrow(
            'Unknown storage provider: s3'
        );
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
        'refuses the prototype member %p instead of returning it as a provider',
        (name) => {
            // `get` used to be a bare index on a plain object, so
            // `providers['constructor']` resolved `Object` — truthy, so it was
            // returned as if it were a provider and blew up at the first `put`.
            // `has` already used `hasOwnProperty`, so the two disagreed.
            const registry = buildRegistry({ local: provider });

            expect(registry.has(name)).toBe(false);
            expect(() => registry.get(name)).toThrow(
                `Unknown storage provider: ${name}`
            );
        }
    );
});
