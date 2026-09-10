import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ProtectionPlugin } from './protection-plugin';

describe('ProtectionPlugin', () => {
    it('registers under a stable name', () => {
        // The name keys the plugin in the host's list and appears in
        // `plugins.spec.ts`; changing it is a host-visible rename.
        expect(ProtectionPlugin().name).toBe('protection');
    });

    /**
     * Its own journal table, like every other plugin that owns tables: the host
     * applies each plugin's pending migrations independently, so installing
     * this one later must disturb nothing already applied.
     */
    it('tracks its migrations in a table of its own', () => {
        expect(ProtectionPlugin().migrations?.table).toBe(
            '__drizzle_migrations_protection'
        );
    });

    /**
     * A thunk, not a value: it has to resolve at migrate time and work whether
     * the package is consumed from source or installed from npm.
     */
    it('points at a migrations directory that exists', () => {
        const dir = ProtectionPlugin().migrations?.dir();

        expect(dir).toBeDefined();
        expect(existsSync(dir as string)).toBe(true);
        expect(
            existsSync(join(dir as string, '0000_init_protection.sql'))
        ).toBe(true);
    });

    /**
     * `ProtectionRuleView` is an `interface`, so the swagger scanner arrives at
     * both reads with a bare 200 and no content. Without this hook the
     * reference documents two routes that answer "something".
     */
    it('brings a documentation pass', () => {
        expect(typeof ProtectionPlugin().docs?.decorate).toBe('function');
    });

    /**
     * No configuration at all — the rule table is the whole configuration
     * surface and its empty state is the off state. A plugin that had to be
     * switched on twice, once by the operator and once per workspace, is the
     * settings screen ADR-0009 deleted.
     */
    it('takes no arguments', () => {
        expect(ProtectionPlugin).toHaveLength(0);
    });
});
