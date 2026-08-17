import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { queryClient } from '.';
import { ApiError } from '../apiError';

/** The shipped predicate, read off the client the whole app actually mounts. */
const retry = queryClient.getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown
) => boolean;

function axiosErrorWith(status: number): AxiosError {
    const config = { url: '/x', headers: {} } as never;
    return new AxiosError('failed', String(status), config, {}, {
        data: {},
        status,
        statusText: '',
        headers: {},
        config
    } as unknown as AxiosResponse);
}

describe('queryClient retry policy', () => {
    it('is configured at all — the default 3× ladder is not inherited blindly', () => {
        expect(typeof retry).toBe('function');
    });

    // BUG-utils-admin-02 claimed a bare `new QueryClient()`. It is not: a 4xx
    // fails fast, which is what keeps a 404 from parking the page on a skeleton.
    it.each([400, 401, 403, 404, 409, 418, 422, 499])(
        'does not retry the settled client error %i',
        (status) => {
            expect(retry(0, axiosErrorWith(status))).toBe(false);
        }
    );

    it.each([408, 429])('retries the transient client error %i', (status) => {
        expect(retry(0, axiosErrorWith(status))).toBe(true);
    });

    it.each([500, 502, 503, 504])('retries the server error %i', (status) => {
        expect(retry(0, axiosErrorWith(status))).toBe(true);
    });

    it('retries a transport failure with no response at all', () => {
        expect(retry(0, new ApiError(null, 'Network Error'))).toBe(true);
    });

    // The boundary the whole policy hinges on: 399/400 and 499/500.
    it('puts the fail-fast boundary exactly at 400 and 500', () => {
        expect(retry(0, axiosErrorWith(399))).toBe(true);
        expect(retry(0, axiosErrorWith(400))).toBe(false);
        expect(retry(0, axiosErrorWith(499))).toBe(false);
        expect(retry(0, axiosErrorWith(500))).toBe(true);
    });

    it('gives up after three attempts even on a retryable failure', () => {
        expect(retry(2, axiosErrorWith(500))).toBe(true);
        expect(retry(3, axiosErrorWith(500))).toBe(false);
    });

    it('normalizes an already-normalized ApiError the same way', () => {
        expect(retry(0, new ApiError(404, 'gone'))).toBe(false);
        expect(retry(0, new ApiError(503, 'down'))).toBe(true);
    });
});
