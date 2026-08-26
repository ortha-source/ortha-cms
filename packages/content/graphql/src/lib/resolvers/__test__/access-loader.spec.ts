import type {
    EntryAccessQuery,
    EntryAccessSourceRegistry
} from '@orthacms/content-server';
import { AccessLoader } from '../access-loader';

/** A stand-in registry recording every batch it was handed. */
function stubRegistry(
    answers: Record<string, { restricted: boolean; dimensions: string[] }>,
    active = true
) {
    const calls: EntryAccessQuery[] = [];
    const registry = {
        active,
        async describe(query: EntryAccessQuery) {
            calls.push(query);
            return new Map(Object.entries(answers));
        }
    };
    return {
        registry: registry as unknown as EntryAccessSourceRegistry,
        calls
    };
}

describe('AccessLoader', () => {
    it('coalesces every load of one tick into a single call', async () => {
        const { registry, calls } = stubRegistry({
            e1: { restricted: true, dimensions: ['org'] },
            e2: { restricted: false, dimensions: [] }
        });
        const loader = new AccessLoader(registry, 'w1');

        const [first, second] = await Promise.all([
            loader.load('e1'),
            loader.load('e2')
        ]);

        expect(calls).toHaveLength(1);
        expect([...calls[0].entryIds].sort()).toEqual(['e1', 'e2']);
        expect(calls[0].workspaceId).toBe('w1');
        expect(first.restricted).toBe(true);
        expect(second.restricted).toBe(false);
    });

    it('asks once for an id requested twice', async () => {
        const { registry, calls } = stubRegistry({
            e1: { restricted: true, dimensions: ['plan'] }
        });
        const loader = new AccessLoader(registry, 'w1');

        await Promise.all([loader.load('e1'), loader.load('e1')]);

        expect(calls[0].entryIds).toEqual(['e1']);
    });

    /**
     * The default the whole feature runs on: absence is openness. An id the
     * sources did not describe is unrestricted, which is what every entry is
     * before anybody writes a rule.
     */
    it('reads an undescribed id as unrestricted', async () => {
        const { registry } = stubRegistry({});
        const loader = new AccessLoader(registry, 'w1');
        await expect(loader.load('e1')).resolves.toEqual({
            restricted: false,
            dimensions: []
        });
    });

    /**
     * The field is on every entry type of every schema, so what it costs when
     * nothing is registered is what every deployment pays.
     */
    it('never dispatches when nothing is registered', async () => {
        const { registry, calls } = stubRegistry({}, false);
        const loader = new AccessLoader(registry, 'w1');
        await expect(loader.load('e1')).resolves.toEqual({
            restricted: false,
            dimensions: []
        });
        expect(calls).toHaveLength(0);
    });

    it('answers unrestricted with no registry at all', async () => {
        const loader = new AccessLoader(undefined, 'w1');
        await expect(loader.load('e1')).resolves.toEqual({
            restricted: false,
            dimensions: []
        });
    });

    it('starts a fresh batch for a later tick', async () => {
        const { registry, calls } = stubRegistry({
            e1: { restricted: true, dimensions: [] }
        });
        const loader = new AccessLoader(registry, 'w1');

        await loader.load('e1');
        await loader.load('e2');

        expect(calls).toHaveLength(2);
        expect(calls[1].entryIds).toEqual(['e2']);
    });
});
