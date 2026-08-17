import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '.';
import { STALE_TIME } from '../staleTime';

describe('HTTP_STATUS', () => {
    it('names the codes the UI branches on', () => {
        expect(HTTP_STATUS).toEqual({
            BAD_REQUEST: 400,
            UNAUTHORIZED: 401,
            FORBIDDEN: 403,
            NOT_FOUND: 404,
            CONFLICT: 409,
            TOO_MANY_REQUESTS: 429
        });
    });
});

describe('STALE_TIME', () => {
    it('holds the four presets, in milliseconds and ascending', () => {
        expect(STALE_TIME).toEqual({
            None: 0,
            Short: 30_000,
            Standard: 60_000,
            Forever: Infinity
        });
        expect(STALE_TIME.None).toBeLessThan(STALE_TIME.Short);
        expect(STALE_TIME.Short).toBeLessThan(STALE_TIME.Standard);
        expect(STALE_TIME.Standard).toBeLessThan(STALE_TIME.Forever);
    });
});
