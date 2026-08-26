import {
    EntryAccessSourceRegistry,
    type EntryAccessDescription,
    type EntryAccessQuery,
    type EntryAccessSource
} from './entry-access-source';

/** A source returning a fixed answer, recording what it was asked. */
function fixedSource(
    answers: Record<string, EntryAccessDescription>
): EntryAccessSource & { calls: EntryAccessQuery[] } {
    const calls: EntryAccessQuery[] = [];
    return {
        calls,
        async describe(query) {
            calls.push(query);
            return new Map(Object.entries(answers));
        }
    };
}

describe('EntryAccessSourceRegistry', () => {
    /**
     * The state every installation without a scoping plugin is in, and the one
     * that must cost nothing: the field is on every entry type of every schema,
     * so its unused cost is the cost everyone pays.
     */
    it('describes nothing, and calls nothing, when empty', async () => {
        const registry = new EntryAccessSourceRegistry();
        expect(registry.active).toBe(false);
        const described = await registry.describe({
            workspaceId: 'w1',
            entryIds: ['e1']
        });
        expect(described.size).toBe(0);
    });

    it('does not dispatch for an empty page', async () => {
        const registry = new EntryAccessSourceRegistry();
        const source = fixedSource({});
        registry.register(source);
        await registry.describe({ workspaceId: 'w1', entryIds: [] });
        expect(source.calls).toHaveLength(0);
    });

    it('ignores a repeat registration of the same instance', () => {
        const registry = new EntryAccessSourceRegistry();
        const source = fixedSource({});
        registry.register(source);
        registry.register(source);
        expect(registry.active).toBe(true);
    });

    it('leaves an undescribed id out, so the caller reads it as open', async () => {
        const registry = new EntryAccessSourceRegistry();
        registry.register(
            fixedSource({ e1: { restricted: true, dimensions: ['org'] } })
        );
        const described = await registry.describe({
            workspaceId: 'w1',
            entryIds: ['e1', 'e2']
        });
        expect(described.has('e2')).toBe(false);
    });

    /**
     * The merge can only ever tighten. Two plugins narrowing reads for
     * different reasons both have to be heard, and the safe direction for a
     * disagreement is the one that stops a shared cache storing the entry.
     */
    it('merges two sources by union, and a `true` wins', async () => {
        const registry = new EntryAccessSourceRegistry();
        registry.register(
            fixedSource({ e1: { restricted: false, dimensions: ['plan'] } })
        );
        registry.register(
            fixedSource({ e1: { restricted: true, dimensions: ['org'] } })
        );
        const described = await registry.describe({
            workspaceId: 'w1',
            entryIds: ['e1']
        });
        expect(described.get('e1')).toEqual({
            restricted: true,
            // Sorted, so two deployments registering the same sources in
            // different orders produce the same cache key.
            dimensions: ['org', 'plan']
        });
    });
});
