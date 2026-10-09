import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import { EntryWriterService } from './entry-writer.service';

/**
 * A save's relation and media targets are checked **inside** its transaction,
 * and the rows read are held for the rest of it.
 *
 * Checked beforehand, on the pool, the answer was stale by the time the row was
 * written: a relation target deleted in between turned the insert's foreign key
 * into a 500, and a media asset — whose id has no foreign key at all — into a
 * stored id naming nothing. What distinguishes the two implementations is
 * where the reads happen and what they lock, so that is what is asserted.
 */

const author = collection('targets_tx_author', {
    fields: { name: field.text() }
});

const post: AnyContentType = collection('targets_tx_post', {
    publishable: true,
    fields: {
        title: field.text(),
        author: field.relation({ to: () => author }),
        cover: field.media()
    }
}) as AnyContentType;

const AUTHOR_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const ASSET_ID = '9f8e7d6c-5b4a-4c3d-9e1f-0a9b8c7d6e5f';

/** Stops the write once the checks have run; nothing after them matters. */
class StopBeforeInsert extends Error {}

function harness() {
    const events: string[] = [];
    let inTransaction = false;
    const where = (state: string) =>
        inTransaction ? `${state} (in tx)` : state;

    const tx = {
        execute: async () => undefined,
        select: () => {
            const query = {
                from: () => query,
                where: () => query,
                // `findLive`, the update's read of the row it replaces.
                limit: async () => [],
                for: async (strength: string) => {
                    events.push(where(`relation probe for ${strength}`));
                    return [{ id: AUTHOR_ID, workspaceId: 'ws' }];
                },
                then: (resolve: (rows: unknown[]) => unknown) => {
                    events.push(where('relation probe, unlocked'));
                    return resolve([{ id: AUTHOR_ID, workspaceId: 'ws' }]);
                }
            };
            return query;
        },
        insert: () => {
            throw new StopBeforeInsert();
        },
        update: () => {
            throw new StopBeforeInsert();
        }
    };
    const uow = {
        current: () => tx,
        run: async <T>(work: () => Promise<T>) => {
            inTransaction = true;
            try {
                return await work();
            } finally {
                inTransaction = false;
            }
        }
    };
    const relations = { linkableWhere: () => undefined };
    const media = {
        resolve: jest.fn(
            async (ids: readonly string[], _ws: string, options?: object) => {
                events.push(
                    where(`media resolve ${JSON.stringify(options ?? {})}`)
                );
                return new Map(
                    ids.map((id) => [
                        id,
                        {
                            id,
                            kind: 'image',
                            mimeType: 'image/png',
                            name: 'a.png',
                            url: '',
                            alt: null,
                            tracks: []
                        }
                    ])
                );
            }
        )
    };

    const writer = new EntryWriterService(
        tx as never,
        uow as never,
        {} as never,
        {} as never,
        relations as never,
        {} as never,
        {} as never,
        undefined,
        media as never
    );
    return { writer, events };
}

describe('EntryWriterService target checks', () => {
    it('run inside the create transaction, holding the targets', async () => {
        const { writer, events } = harness();

        await expect(
            writer.create(
                post,
                { title: 'Hello', author: AUTHOR_ID, cover: ASSET_ID },
                'ws'
            )
        ).rejects.toBeInstanceOf(StopBeforeInsert);

        expect(events).toEqual([
            'relation probe for key share (in tx)',
            'media resolve {"lock":true} (in tx)'
        ]);
    });

    it('run inside the update transaction, holding the targets', async () => {
        const { writer, events } = harness();

        await expect(
            writer.update(
                post,
                '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e',
                { title: 'Hello', author: AUTHOR_ID, cover: ASSET_ID },
                'ws'
            )
        ).rejects.toBeInstanceOf(StopBeforeInsert);

        expect(events).toEqual([
            'relation probe for key share (in tx)',
            'media resolve {"lock":true} (in tx)'
        ]);
    });
});
