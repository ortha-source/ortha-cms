import { MediaAssetResolverQuery } from './media-asset-resolver.query';

/**
 * Content's entry write asks for a **locking** read: on its own transaction,
 * holding the assets `FOR KEY SHARE`, because an asset id carries no foreign
 * key to stop the asset being deleted between the check and the commit.
 * Display reads stay plain reads on the pool.
 */
describe('MediaAssetResolverQuery', () => {
    function executor(label: string, seen: string[]) {
        const rows = [
            {
                id: 'a1',
                kind: 'image',
                mimeType: 'image/png',
                name: 'a.png',
                alt: null,
                tracks: [],
                variants: {}
            }
        ];
        return {
            select: () => {
                const query = {
                    from: () => query,
                    where: () => query,
                    for: async (strength: string) => {
                        seen.push(`${label} for ${strength}`);
                        return rows;
                    },
                    then: (resolve: (value: unknown) => unknown) => {
                        seen.push(`${label} unlocked`);
                        return resolve(rows);
                    }
                };
                return query;
            }
        };
    }

    function build() {
        const seen: string[] = [];
        const db = executor('pool', seen);
        const tx = executor('transaction', seen);
        const query = new MediaAssetResolverQuery(
            db as never,
            { current: () => tx } as never
        );
        return { query, seen };
    }

    it("reads on the caller's transaction and holds the rows when asked to lock", async () => {
        const { query, seen } = build();

        const resolved = await query.resolve(['a1'], 'ws', { lock: true });

        expect(resolved.has('a1')).toBe(true);
        expect(seen).toEqual(['transaction for key share']);
    });

    it('stays a plain read otherwise', async () => {
        const { query, seen } = build();

        await query.resolve(['a1'], 'ws');

        expect(seen).toEqual(['pool unlocked']);
    });
});
