import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, setActiveWorkspaceId, setUnauthorizedHandler } from '.';

/**
 * Drives the real interceptor stack by swapping the adapter, so what is under
 * test is the shipped `apiClient` singleton rather than a re-implementation of
 * its rules.
 */
function stubTransport(status: number) {
    const seen: { headers: Record<string, unknown> }[] = [];
    apiClient.defaults.adapter = async (config) => {
        seen.push({ headers: { ...config.headers } });
        const response = {
            data: { message: 'stub' },
            status,
            statusText: '',
            headers: {},
            config
        } as unknown as AxiosResponse;
        if (status >= 400) {
            throw new AxiosError(
                `Request failed with status code ${status}`,
                String(status),
                config,
                {},
                response
            );
        }
        return response;
    };
    return seen;
}

afterEach(() => {
    setUnauthorizedHandler(null);
    setActiveWorkspaceId(null);
    apiClient.defaults.adapter = undefined;
});

describe('apiClient', () => {
    it('targets the API behind the host prefix and sends credentials', () => {
        expect(apiClient.defaults.baseURL).toBe('/api');
        expect(apiClient.defaults.withCredentials).toBe(true);
    });

    describe('the workspace header', () => {
        it('is omitted while no workspace is open', async () => {
            const seen = stubTransport(200);
            await apiClient.get('/users');
            expect(seen[0].headers['X-Workspace-Id']).toBeUndefined();
        });

        it('carries the active workspace once one is opened, and stops when it is cleared', async () => {
            const seen = stubTransport(200);
            setActiveWorkspaceId('ws-a');
            await apiClient.get('/content/entries');
            setActiveWorkspaceId('ws-b');
            await apiClient.get('/content/entries');
            setActiveWorkspaceId(null);
            await apiClient.get('/users');

            expect(seen[0].headers['X-Workspace-Id']).toBe('ws-a');
            expect(seen[1].headers['X-Workspace-Id']).toBe('ws-b');
            expect(seen[2].headers['X-Workspace-Id']).toBeUndefined();
        });
    });

    describe('the global 401 handler', () => {
        it('fires once on an unexpected 401 and still rethrows', async () => {
            stubTransport(401);
            const handler = vi.fn();
            setUnauthorizedHandler(handler);

            await expect(apiClient.get('/users')).rejects.toThrow();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('leaves any other status alone', async () => {
            stubTransport(403);
            const handler = vi.fn();
            setUnauthorizedHandler(handler);

            await expect(apiClient.get('/users')).rejects.toThrow();
            expect(handler).not.toHaveBeenCalled();
        });

        it('rethrows unchanged when no handler is installed', async () => {
            stubTransport(401);
            await expect(apiClient.get('/users')).rejects.toMatchObject({
                response: { status: 401 }
            });
        });

        it.each([
            '/auth/login',
            '/auth/logout',
            '/auth/me',
            '/auth/invite/tok-123',
            '/auth/invite/accept'
        ])('stays out of the way on the self-handled path %s', async (url) => {
            stubTransport(401);
            const handler = vi.fn();
            setUnauthorizedHandler(handler);

            await expect(apiClient.get(url)).rejects.toThrow();
            expect(handler).not.toHaveBeenCalled();
        });

        // BUG-utils-admin-07 — the exemption was a bare `startsWith` on the
        // as-passed URL, so a call without the leading slash (which axios
        // resolves correctly against `baseURL`) fell out of the list and a
        // rejected sign-in read as a lost session.
        it.each(['auth/login', 'auth/me', 'auth/invite/tok-123'])(
            'still exempts %s when the caller omits the leading slash',
            async (url) => {
                stubTransport(401);
                const handler = vi.fn();
                setUnauthorizedHandler(handler);

                await expect(apiClient.get(url)).rejects.toThrow();
                expect(handler).not.toHaveBeenCalled();
            }
        );

        it('exempts a self-handled path carrying a query string', async () => {
            stubTransport(401);
            const handler = vi.fn();
            setUnauthorizedHandler(handler);

            await expect(
                apiClient.get('/auth/me?fresh=1')
            ).rejects.toThrow();
            expect(handler).not.toHaveBeenCalled();
        });

        // EC-02 — `startsWith` with no segment boundary silently exempted any
        // future sibling path, which is a fail-open: a dead session on
        // `/auth/logins-report` would never sign the user out.
        it.each([
            '/auth/logins-report',
            '/auth/invites-admin',
            '/auth/meta',
            '/auth/logout-all'
        ])('does not exempt the prefix-sharing path %s', async (url) => {
            stubTransport(401);
            const handler = vi.fn();
            setUnauthorizedHandler(handler);

            await expect(apiClient.get(url)).rejects.toThrow();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        // EC-04 — a handler that throws must not replace the caller's rejection,
        // or every `catch` in the app misidentifies the failure.
        it('rethrows the original 401 even if the handler throws', async () => {
            stubTransport(401);
            setUnauthorizedHandler(() => {
                throw new Error('handler blew up');
            });

            await expect(apiClient.get('/users')).rejects.toMatchObject({
                response: { status: 401 }
            });
        });
    });
});
