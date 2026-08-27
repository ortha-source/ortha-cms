import {
    EntryWriteExtensionRegistry,
    type EntryWriteExtension,
    type EntryWriteExtensionTarget
} from './entry-write-extension';

/** Neither method touches the target, so a bare stand-in is enough. */
const TARGET = {} as EntryWriteExtensionTarget;

/** A recording extension over one in-memory value. */
function fake(
    key: string,
    stored: unknown = undefined
): EntryWriteExtension & {
    applied: unknown[];
    value: unknown;
} {
    return {
        key,
        applied: [] as unknown[],
        value: stored,
        async apply({ value }) {
            this.applied.push(value);
            this.value = value;
        },
        async capture() {
            return this.value;
        }
    };
}

describe('EntryWriteExtensionRegistry', () => {
    describe('applyAll', () => {
        it('runs only the extensions the caller named', async () => {
            const registry = new EntryWriteExtensionRegistry();
            const access = fake('access');
            const other = fake('other');
            registry.register(access);
            registry.register(other);

            await registry.applyAll(TARGET, { access: { allow: ['a'] } });

            expect(access.applied).toEqual([{ allow: ['a'] }]);
            // The one nobody mentioned is left alone — a save that says nothing
            // about a plugin's state must not clear it.
            expect(other.applied).toEqual([]);
        });

        it('runs an extension asked for an explicitly empty value', async () => {
            // "Open this up to everyone" is a value, not an absence, and
            // `key in inputs` is what tells the two apart.
            const registry = new EntryWriteExtensionRegistry();
            const access = fake('access', { allow: ['a'] });
            registry.register(access);

            await registry.applyAll(TARGET, {
                access: { allow: [], deny: [] }
            });

            expect(access.value).toEqual({ allow: [], deny: [] });
        });

        it('ignores a key nothing owns', async () => {
            // The bag is forwarded from a client that may be talking to a
            // deployment without that plugin; failing the save would make one
            // request work on one install and 400 on another.
            const registry = new EntryWriteExtensionRegistry();
            registry.register(fake('access'));

            // Nothing owned the key, so nothing else was touched — an empty
            // list, not a rejection.
            await expect(
                registry.applyAll(TARGET, { nobody: 1 })
            ).resolves.toEqual([]);
        });

        it('does nothing when the caller sent no bag at all', async () => {
            const registry = new EntryWriteExtensionRegistry();
            const access = fake('access');
            registry.register(access);

            await registry.applyAll(TARGET, undefined);

            expect(access.applied).toEqual([]);
        });
    });

    describe('captureAll', () => {
        it('records every extension, not only the ones this save wrote', async () => {
            // The whole point: a version that omitted the state it did not
            // change would restore as a version that had none.
            const registry = new EntryWriteExtensionRegistry();
            registry.register(fake('access', { allow: ['a'] }));
            registry.register(fake('other', 7));

            await expect(registry.captureAll(TARGET)).resolves.toEqual({
                access: { allow: ['a'] },
                other: 7
            });
        });

        it('omits an extension that holds nothing', async () => {
            const registry = new EntryWriteExtensionRegistry();
            registry.register(fake('access', undefined));
            registry.register(fake('other', 7));

            await expect(registry.captureAll(TARGET)).resolves.toEqual({
                other: 7
            });
        });

        it('returns undefined when nothing is registered', async () => {
            // Not an empty object: a snapshot on an install with no extensions
            // has to stay byte-for-byte what it was before this port existed.
            await expect(
                new EntryWriteExtensionRegistry().captureAll(TARGET)
            ).resolves.toBeUndefined();
        });

        it('returns undefined when every extension holds nothing', async () => {
            const registry = new EntryWriteExtensionRegistry();
            registry.register(fake('access', undefined));

            await expect(registry.captureAll(TARGET)).resolves.toBeUndefined();
        });
    });

    it('registers an instance once', () => {
        const registry = new EntryWriteExtensionRegistry();
        const access = fake('access');
        registry.register(access);
        registry.register(access);

        expect(registry.configured).toBe(true);
    });
});
