import { COPILOT_LIMIT_CODES } from '@orthacms/copilot-domain';
import type { Response } from 'express';
import { limitException } from './limit-exception';

function response() {
    const headers: Record<string, string> = {};
    return {
        headers,
        res: {
            setHeader: (name: string, value: string) => {
                headers[name] = value;
            }
        } as unknown as Response
    };
}

describe('limitException', () => {
    const now = new Date('2026-10-19T23:59:30.000Z');

    it('is a 429 carrying the code, scope and reset time [copilot:I-44]', () => {
        const { res } = response();

        const exception = limitException(
            {
                code: COPILOT_LIMIT_CODES.QUOTA_EXCEEDED,
                scope: 'workspace',
                resetsAt: new Date('2026-10-20T00:00:00.000Z')
            },
            res,
            now
        );

        expect(exception.getStatus()).toBe(429);
        expect(exception.getResponse()).toEqual({
            statusCode: 429,
            code: 'copilot.quota_exceeded',
            scope: 'workspace',
            message: expect.stringContaining('workspace'),
            resetsAt: '2026-10-20T00:00:00.000Z'
        });
    });

    it('waits until the quota resets', () => {
        const { res, headers } = response();

        limitException(
            {
                code: COPILOT_LIMIT_CODES.QUOTA_EXCEEDED,
                scope: 'user',
                resetsAt: new Date('2026-10-20T00:00:00.000Z')
            },
            res,
            now
        );

        expect(headers['Retry-After']).toBe('30');
    });

    it('waits out the rate limit’s window, rounded up', () => {
        const { res, headers } = response();

        limitException(
            {
                code: COPILOT_LIMIT_CODES.RATE_LIMITED,
                scope: 'user',
                retryAfterMs: 12_400
            },
            res,
            now
        );

        expect(headers['Retry-After']).toBe('13');
    });

    // Nobody can say when a run the user has in flight will end.
    it('names no wait for a concurrency refusal', () => {
        const { res, headers } = response();

        limitException(
            { code: COPILOT_LIMIT_CODES.TOO_MANY_RUNS, scope: 'user' },
            res,
            now
        );

        expect(headers).toEqual({});
    });
});
