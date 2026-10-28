import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The inbox contract's zero-dependency rule, asserted rather than reviewed.
 * Every producer — protection, alarms — imports this package for the writer
 * token it injects optionally; a dependency here would be inherited by all of
 * them, and the inbox's server never should be.
 */
describe('@orthacms/inbox-domain package manifest', () => {
    const manifest = JSON.parse(
        readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')
    ) as {
        name: string;
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };

    it('is the package it claims to be', () => {
        expect(manifest.name).toBe('@orthacms/inbox-domain');
    });

    it.each(['dependencies', 'peerDependencies', 'devDependencies'] as const)(
        'declares no %s',
        (field) => {
            expect(Object.keys(manifest[field] ?? {})).toEqual([]);
        }
    );
});
