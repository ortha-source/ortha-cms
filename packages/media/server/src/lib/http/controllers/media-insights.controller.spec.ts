import 'reflect-metadata';
import type { MediaInsightsQuery } from '../../infrastructure/queries/media-insights.query';
import { MediaInsightsController, toLimit } from './media-insights.controller';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/** The metadata key `@RequirePermissions` writes (identity-server). */
const PERMISSIONS_KEY = 'orthacms:required-permissions';

describe('MediaInsightsController — alt-text drill-down', () => {
    it('is gated on media:read with the rest of the controller', () => {
        expect(
            Reflect.getMetadata(PERMISSIONS_KEY, MediaInsightsController)
        ).toEqual(['media:read']);
    });

    it('clamps the limit to the panel’s cap and defaults on junk', () => {
        expect(toLimit('10')).toBe(10);
        expect(toLimit('1000')).toBe(50);
        expect(toLimit('0')).toBe(20);
        expect(toLimit('abc')).toBe(20);
        expect(toLimit(undefined)).toBe(20);
    });

    it('reads the missing images for the caller’s workspace', async () => {
        const calls: unknown[][] = [];
        const query = {
            altMissing: async (...args: unknown[]) => {
                calls.push(args);
                return { total: 0, assets: [] };
            }
        } as unknown as MediaInsightsQuery;

        await new MediaInsightsController(query).altMissing(WORKSPACE, '7');

        expect(calls).toEqual([[WORKSPACE, 7]]);
    });
});
