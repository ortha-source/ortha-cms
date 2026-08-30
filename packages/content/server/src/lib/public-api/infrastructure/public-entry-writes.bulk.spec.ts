import {
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';
import type { PublicBulkSaveItemDto } from '../http/dto/public-bulk.dto';
import type { PublicEntry } from '../types/public-entry';
import { PublicEntryWritesService } from './public-entry-writes.service';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
const GRANTED = new Set(['article']);

/** A type stand-in: `bulkSave` only ever passes it through to create/update. */
const TYPE = { name: 'article' } as unknown as AnyContentType;

/** An entry stand-in, distinguishable per id. */
function entry(id: string): PublicEntry {
    return { id } as unknown as PublicEntry;
}

/**
 * The service with its collaborators absent — `bulkSave` is tested against its
 * own `create` / `update`, which are stubbed here.
 *
 * That is the seam worth pinning: what `bulkSave` adds over the single-entry
 * writes is dispatch, ordering, the per-item verdicts and the error mapping.
 * The write pipeline underneath is the same one `create` and `update` have
 * always used and is covered where it lives, so exercising it again through a
 * batch would test Drizzle rather than this method.
 */
function serviceWith(
    create: jest.Mock,
    update: jest.Mock
): PublicEntryWritesService {
    const service = new PublicEntryWritesService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
    );
    (service as unknown as { create: jest.Mock }).create = create;
    (service as unknown as { update: jest.Mock }).update = update;
    return service;
}

/** Save items, as the DTO delivers them. */
function items(...raw: Partial<PublicBulkSaveItemDto>[]) {
    return raw.map((item) => ({
        values: {},
        ...item
    })) as PublicBulkSaveItemDto[];
}

describe('PublicEntryWritesService.bulkSave', () => {
    it('dispatches each item by how it is addressed, and tallies both', async () => {
        const create = jest.fn().mockResolvedValue(entry(ID));
        const update = jest.fn().mockResolvedValue(entry(OTHER));
        const service = serviceWith(create, update);

        const result = await service.bulkSave(
            TYPE,
            items({ values: { title: 'New' } }, { id: OTHER }),
            'ws',
            GRANTED
        );

        expect(create).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ created: 1, updated: 1, failed: 0 });
        expect(result.items.map((item) => item.op)).toEqual([
            'create',
            'update'
        ]);
    });

    // The whole point of the endpoint: an import of fifty records must not be
    // thrown away because one of them names a relation that no longer exists.
    it('keeps going after a failure and reports the rest', async () => {
        const create = jest
            .fn()
            .mockResolvedValueOnce(entry(ID))
            .mockRejectedValueOnce(
                new UnprocessableEntityException({
                    message: 'Validation failed.',
                    issues: [{ field: 'title', message: 'is required' }]
                })
            )
            .mockResolvedValueOnce(entry(OTHER));
        const service = serviceWith(create, jest.fn());

        const result = await service.bulkSave(
            TYPE,
            items({}, {}, {}),
            'ws',
            GRANTED
        );

        expect(result).toMatchObject({ created: 2, failed: 1 });
        expect(result.items[1]).toMatchObject({
            index: 1,
            ok: false,
            error: {
                status: 422,
                message: 'Validation failed.',
                issues: [{ field: 'title', message: 'is required' }]
            }
        });
        // The successes still carry their entries, and stay in request order.
        expect(result.items[0].entry).toEqual(entry(ID));
        expect(result.items[2].entry).toEqual(entry(OTHER));
    });

    it('reports the status the same single-entry call would have failed with', async () => {
        const update = jest
            .fn()
            .mockRejectedValue(new NotFoundException('No such entry.'));
        const service = serviceWith(jest.fn(), update);

        const result = await service.bulkSave(
            TYPE,
            items({ id: ID }),
            'ws',
            GRANTED
        );

        expect(result.items[0]).toMatchObject({
            op: 'update',
            ok: false,
            error: { status: 404, message: 'No such entry.' }
        });
    });

    // A malformed item is that item's problem. Failing the request on it would
    // make one mis-addressed row cost every other row's write.
    it('fails only the item whose addressing is ambiguous', async () => {
        const create = jest.fn().mockResolvedValue(entry(ID));
        const service = serviceWith(create, jest.fn());

        const result = await service.bulkSave(
            TYPE,
            items(
                {},
                { localeGroupId: '22222222-2222-4222-8222-222222222222' }
            ),
            'ws',
            GRANTED
        );

        expect(result).toMatchObject({ created: 1, failed: 1 });
        expect(result.items[1].error?.status).toBe(400);
        expect(create).toHaveBeenCalledTimes(1);
    });

    // Anything that is not an HttpException is a bug, not a rejection — but the
    // batch still has to finish and the item still has to be diagnosable.
    it('reports an unexpected throw as a 500 without abandoning the batch', async () => {
        const create = jest
            .fn()
            .mockRejectedValueOnce(new Error('connection reset'))
            .mockResolvedValueOnce(entry(ID));
        const service = serviceWith(create, jest.fn());

        const result = await service.bulkSave(
            TYPE,
            items({}, {}),
            'ws',
            GRANTED
        );

        expect(result.items[0].error).toEqual({
            status: 500,
            message: 'connection reset'
        });
        expect(result).toMatchObject({ created: 1, failed: 1 });
    });

    it('passes a group-addressed update its addressing locale', async () => {
        const update = jest.fn().mockResolvedValue(entry(ID));
        const service = serviceWith(jest.fn(), update);
        const group = '22222222-2222-4222-8222-222222222222';

        await service.bulkSave(
            TYPE,
            items({ localeGroupId: group, locale: 'de', op: 'update' }),
            'ws',
            GRANTED
        );

        expect(update).toHaveBeenCalledWith(
            TYPE,
            { localeGroupId: group },
            expect.anything(),
            'ws',
            GRANTED,
            'de',
            // The batch forwards its actor to every item, so one bulk write is
            // attributed exactly as the single-entry writes it stands in for.
            undefined
        );
    });

    // `body.locale` is create-only. Reading it as an addressing locale is how a
    // group-addressed German update came to rewrite the English row.
    it('never passes a create item’s locale as an addressing locale', async () => {
        const update = jest.fn().mockResolvedValue(entry(ID));
        const service = serviceWith(jest.fn(), update);

        await service.bulkSave(
            TYPE,
            items({ id: ID, locale: 'de' }),
            'ws',
            GRANTED
        );

        expect(update).toHaveBeenCalledWith(
            TYPE,
            { id: ID },
            expect.anything(),
            'ws',
            GRANTED,
            undefined,
            undefined
        );
    });
});
