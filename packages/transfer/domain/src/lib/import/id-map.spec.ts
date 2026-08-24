import { RESOLVED_VIA, TransferAssetMap, TransferIdMap } from './id-map';

describe('TransferIdMap', () => {
    it('resolves a record written earlier in the same run by source id', () => {
        const map = new TransferIdMap();
        map.remember('author', 'src-1', { email: 'jane@example.com' }, 'tgt-1');

        expect(
            map.resolve({ $type: 'author', $id: 'src-1', $key: {} })
        ).toEqual({ targetId: 'tgt-1', via: RESOLVED_VIA.Document });
    });

    it('resolves an existing target row by natural key', () => {
        const map = new TransferIdMap();
        map.rememberExisting('author', { email: 'jane@example.com' }, 'tgt-9');

        expect(
            map.resolve({
                $type: 'author',
                $key: { email: 'jane@example.com' }
            })
        ).toEqual({ targetId: 'tgt-9', via: RESOLVED_VIA.Existing });
    });

    it('prefers the source id over the key when both would match', () => {
        const map = new TransferIdMap();
        // Same key, two different rows: the document's own id is the exact
        // answer, the key is a guess that could land on the wrong one.
        map.remember('author', 'src-1', { email: 'shared@example.com' }, 'from-document');
        map.rememberExisting('author', { email: 'shared@example.com' }, 'from-database');

        expect(
            map.resolve({
                $type: 'author',
                $id: 'src-1',
                $key: { email: 'shared@example.com' }
            }).targetId
        ).toBe('from-document');
    });

    it('reports unresolved when neither handle matches', () => {
        expect(
            new TransferIdMap().resolve({
                $type: 'author',
                $id: 'nope',
                $key: { email: 'nobody@example.com' }
            })
        ).toEqual({ via: RESOLVED_VIA.Unresolved });
    });

    it('does not index an empty key', () => {
        const map = new TransferIdMap();
        map.remember('author', 'src-1', {}, 'tgt-1');

        // Indexing it would make every keyless author of this type collide.
        expect(
            map.resolve({ $type: 'author', $key: {} })
        ).toEqual({ via: RESOLVED_VIA.Unresolved });
    });

    it('matches a key regardless of the order its fields were written in', () => {
        const map = new TransferIdMap();
        map.rememberExisting('sku', { a: '1', b: '2' }, 'tgt-1');

        expect(
            map.resolve({ $type: 'sku', $key: { b: '2', a: '1' } }).targetId
        ).toBe('tgt-1');
    });

    it('does not let a value containing the separator forge another key', () => {
        const map = new TransferIdMap();
        map.rememberExisting('sku', { a: '1 b 2' }, 'forged');

        expect(
            map.resolve({ $type: 'sku', $key: { a: '1', b: '2' } }).via
        ).toBe(RESOLVED_VIA.Unresolved);
    });
});

describe('TransferAssetMap', () => {
    it('reuses an asset the workspace already holds, by checksum', () => {
        const map = new TransferAssetMap();
        map.rememberChecksum('sha256:abc', 'existing-asset');

        expect(map.resolve('some-source-id', 'sha256:abc')).toBe(
            'existing-asset'
        );
    });

    it('prefers a source id already uploaded in this run', () => {
        const map = new TransferAssetMap();
        map.remember('src-1', 'uploaded', 'sha256:abc');

        expect(map.resolve('src-1')).toBe('uploaded');
    });

    it('returns nothing for an asset it has not seen', () => {
        expect(new TransferAssetMap().resolve('src-1')).toBeUndefined();
    });
});
