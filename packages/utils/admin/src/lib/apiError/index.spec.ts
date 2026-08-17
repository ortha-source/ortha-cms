import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from '.';

function axiosError(
    status: number | null,
    message = 'failed',
    data?: unknown
): AxiosError {
    const config = { url: '/x', headers: {} } as never;
    const response =
        status === null
            ? undefined
            : ({
                  data,
                  status,
                  statusText: '',
                  headers: {},
                  config
              } as unknown as AxiosResponse);
    return new AxiosError(message, 'ERR', config, {}, response);
}

describe('ApiError', () => {
    it('carries the status and the opaque details', () => {
        const error = new ApiError(422, 'nope', { issues: [] });
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('ApiError');
        expect(error.status).toBe(422);
        expect(error.details).toEqual({ issues: [] });
    });

    it('composes a default message from the status', () => {
        expect(new ApiError(500).message).toBe('Request failed with status 500');
        expect(new ApiError(null).message).toBe('Network error');
    });
});

describe('toApiError', () => {
    it('returns the same instance for an ApiError, so wrapping is idempotent', () => {
        const original = new ApiError(404, 'gone');
        expect(toApiError(original)).toBe(original);
        expect(toApiError(toApiError(original))).toBe(original);
    });

    it('unwraps an axios error into status + details', () => {
        const normalized = toApiError(
            axiosError(422, 'Request failed with status code 422', {
                issues: [{ field: 'name', message: 'required' }]
            })
        );
        expect(normalized).toBeInstanceOf(ApiError);
        expect(normalized.status).toBe(422);
        expect(normalized.details).toEqual({
            issues: [{ field: 'name', message: 'required' }]
        });
    });

    it('reports a transport failure as status null with no details', () => {
        const normalized = toApiError(axiosError(null, 'Network Error'));
        expect(normalized.status).toBeNull();
        expect(normalized.message).toBe('Network Error');
        expect(normalized.details).toBeUndefined();
    });

    it('leaves the server message in details, not in message', () => {
        const normalized = toApiError(
            axiosError(500, 'Request failed with status code 500', {
                message: 'boom in the service layer'
            })
        );
        expect(normalized.message).toBe('Request failed with status code 500');
        expect(normalized.details).toEqual({
            message: 'boom in the service layer'
        });
    });

    it.each([
        [new Error('x'), 'x'],
        [new TypeError('bad'), 'bad']
    ])('wraps the plain error %j as a null-status ApiError', (input, message) => {
        const normalized = toApiError(input);
        expect(normalized.status).toBeNull();
        expect(normalized.message).toBe(message);
        expect(normalized.details).toBeUndefined();
    });

    it.each([undefined, null, 'a string', 42, { status: 500 }])(
        'wraps the non-error thrown value %j without inventing a status',
        (input) => {
            const normalized = toApiError(input);
            expect(normalized).toBeInstanceOf(ApiError);
            expect(normalized.status).toBeNull();
        }
    );
});
