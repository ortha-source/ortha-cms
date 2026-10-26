import 'reflect-metadata';
import type { ContentInsightsQuery } from '../../infrastructure/queries/content-insights.query';
import type { ContentRecordsView } from '../../types/content-insights-view';
import { ContentPunchcardController } from './content-punchcard.controller';
import { ContentStaleController } from './content-stale.controller';
import { ContentUnshippedController } from './content-unshipped.controller';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/** The metadata key `@RequirePermissions` writes (identity-server). */
const PERMISSIONS_KEY = 'orthacms:required-permissions';

const EMPTY: ContentRecordsView = { total: 0, types: [], records: [] };

/** A query double that records the arguments each read was called with. */
function makeQuery() {
    const calls: { method: string; args: unknown[] }[] = [];
    const record =
        (method: string, result: unknown) =>
        async (...args: unknown[]) => {
            calls.push({ method, args });
            return result;
        };
    const query = {
        staleRecords: record('staleRecords', EMPTY),
        unshippedRecords: record('unshippedRecords', EMPTY),
        punchcard: record('punchcard', {
            cells: [],
            max: 0,
            total: 0,
            timeZone: 'UTC'
        })
    } as unknown as ContentInsightsQuery;
    return { query, calls };
}

describe('content insights drill-down routes', () => {
    it('are gated on content:read like every other insights read', () => {
        // Class-level metadata: one decorator covers the new handlers too, so
        // a drill-down can never be readable by someone the count is hidden from.
        for (const controller of [
            ContentStaleController,
            ContentUnshippedController
        ]) {
            expect(Reflect.getMetadata(PERMISSIONS_KEY, controller)).toEqual([
                'content:read'
            ]);
        }
    });

    it('reads the stale band it is asked for, clamping the limit', async () => {
        const { query, calls } = makeQuery();
        const controller = new ContentStaleController(query);

        await controller.staleRecords(WORKSPACE, 'months', '500');
        await controller.staleRecords(WORKSPACE, 'nonsense', undefined);

        expect(calls).toEqual([
            { method: 'staleRecords', args: [WORKSPACE, 'months', 50] },
            // An unknown band reads as the one the Needs-attention line counts.
            { method: 'staleRecords', args: [WORKSPACE, 'year', 20] }
        ]);
    });

    it('reads the unshipped records for the caller’s workspace', async () => {
        const { query, calls } = makeQuery();
        const controller = new ContentUnshippedController(query);

        await controller.unshippedRecords(WORKSPACE, '5');

        expect(calls).toEqual([
            { method: 'unshippedRecords', args: [WORKSPACE, 5] }
        ]);
    });

    it('groups the punchcard in the caller’s zone, or UTC for a bad one', async () => {
        const { query, calls } = makeQuery();
        const controller = new ContentPunchcardController(query);

        await controller.punchcard({ days: 7, tz: 'Asia/Tokyo' }, WORKSPACE);
        await controller.punchcard({ tz: 'Not/AZone' }, WORKSPACE);

        expect(calls).toEqual([
            { method: 'punchcard', args: [WORKSPACE, 7, 'Asia/Tokyo'] },
            { method: 'punchcard', args: [WORKSPACE, 30, 'UTC'] }
        ]);
    });
});
