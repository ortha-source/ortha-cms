const execFileSync = jest.fn();

jest.mock('node:child_process', () => ({
    execFileSync: (...args: unknown[]) => execFileSync(...args)
}));

import {
    formatNpmError,
    isRateLimit,
    publishWithRetry,
    runNpmPublish
} from './publish';

const request = { cwd: '/repo', packageRoot: '/repo/dist/pack/packages/x' };

/** npm's shape for a failed `execFileSync`: exit code plus captured streams. */
function npmFailure(stdout: string, stderr = ''): Error {
    return Object.assign(new Error('Command failed'), { stdout, stderr });
}

beforeEach(() => jest.clearAllMocks());

describe('runNpmPublish', () => {
    it('runs from the workspace root with the staged root as an argument', () => {
        execFileSync.mockReturnValue('{}');

        runNpmPublish(request);

        expect(execFileSync).toHaveBeenCalledWith(
            'npm',
            ['publish', '/repo/dist/pack/packages/x', '--json'],
            expect.objectContaining({ cwd: '/repo' })
        );
    });

    it('forwards every registry flag as its own argv element', () => {
        execFileSync.mockReturnValue('{}');

        runNpmPublish({
            ...request,
            registry: 'https://r.example/',
            tag: 'next',
            otp: 123456,
            access: 'public',
            dryRun: true
        });

        expect(execFileSync.mock.calls[0][1]).toEqual([
            'publish',
            '/repo/dist/pack/packages/x',
            '--json',
            '--registry=https://r.example/',
            '--tag=next',
            '--otp=123456',
            '--access=public',
            '--dry-run'
        ]);
    });

    it('reads a republish of an existing version as success [nx:I-25]', () => {
        execFileSync.mockImplementation(() => {
            throw npmFailure('', 'npm error code EPUBLISHCONFLICT');
        });

        expect(runNpmPublish(request).status).toBe('already-published');
    });

    it.each([
        ['npm error code E429', 'rate limited by the registry'],
        [
            'npm error 503 Service Unavailable - PUT',
            'the registry returned a server error'
        ],
        ['npm error code E500', 'the registry returned a server error'],
        ['npm error socket hang up', 'the connection to the registry failed'],
        ['npm error code ECONNRESET', 'the connection to the registry failed']
    ])('classifies %s as retryable', (output, reason) => {
        execFileSync.mockImplementation(() => {
            throw npmFailure(output);
        });

        expect(runNpmPublish(request)).toMatchObject({
            status: 'retryable',
            reason
        });
    });

    it.each([
        'npm error code E403 Forbidden',
        'npm error code ENEEDAUTH',
        'npm error Tarball is not a package: 503 bytes'
        // covers: nx:I-28
    ])('does not retry %s — that answer will not change', (output) => {
        execFileSync.mockImplementation(() => {
            throw npmFailure(output);
        });

        expect(runNpmPublish(request).status).toBe('failed');
    });
});

describe('isRateLimit', () => {
    it.each([
        'E429',
        '429 Too Many Requests',
        'rate limit exceeded',
        'ERATELIMIT'
    ])('recognises %s', (text) => expect(isRateLimit(text)).toBe(true));

    it('does not fire on an unrelated 403', () => {
        expect(isRateLimit('npm error code E403')).toBe(false);
    });
});

describe('publishWithRetry', () => {
    const log = jest.fn();
    const options = { retries: 2, backoff: 1, maxBackoff: 1, log };

    it('returns on the first success without retrying', async () => {
        execFileSync.mockReturnValue('ok');

        await expect(publishWithRetry(request, options)).resolves.toMatchObject(
            {
                status: 'published'
            }
        );
        expect(execFileSync).toHaveBeenCalledTimes(1);
    });

    it('retries a rate-limited version bump up to the configured ceiling [nx:I-26]', async () => {
        execFileSync.mockImplementation(() => {
            throw npmFailure('npm error code E429');
        });

        await expect(publishWithRetry(request, options)).resolves.toMatchObject(
            {
                status: 'failed'
            }
        );
        expect(execFileSync).toHaveBeenCalledTimes(3);
    });

    it('stops retrying once a transient failure clears', async () => {
        execFileSync
            .mockImplementationOnce(() => {
                throw npmFailure('npm error code E429');
            })
            .mockReturnValueOnce('ok');

        await expect(publishWithRetry(request, options)).resolves.toMatchObject(
            {
                status: 'published'
            }
        );
        expect(execFileSync).toHaveBeenCalledTimes(2);
    });

    /**
     * Creating a package name is metered on its own schedule that no backoff
     * outlasts, so it gets one attempt and an honest answer rather than a
     * twelve-minute ladder per package.
     */
    it('gives a rate-limited name creation exactly one attempt [nx:I-26]', async () => {
        execFileSync.mockImplementation(() => {
            throw npmFailure('npm error code E429');
        });

        await expect(
            publishWithRetry(request, { ...options, creatingName: true })
        ).resolves.toMatchObject({ status: 'creation-blocked' });
        expect(execFileSync).toHaveBeenCalledTimes(1);
    });

    it('still retries a creation that failed for a non-rate-limit reason', async () => {
        execFileSync.mockImplementation(() => {
            throw npmFailure('npm error code E503');
        });

        await publishWithRetry(request, { ...options, creatingName: true });

        expect(execFileSync).toHaveBeenCalledTimes(3);
    });
});

describe('formatNpmError', () => {
    it('pulls npm’s code, summary and detail out of mixed streams', () => {
        expect(
            formatNpmError(
                'npm notice publishing\n{"error":{"code":"E403","summary":"Forbidden","detail":"you do not have permission"}}\nnpm error done'
            )
        ).toBe('E403\nForbidden\nyou do not have permission');
    });

    it('falls back to the raw output when the slice is not one JSON document', () => {
        const raw = '{"a":1}\nnoise\n{"b":2}';

        expect(formatNpmError(raw)).toBe(raw);
    });

    it('falls back to the raw output when there is no JSON at all', () => {
        expect(formatNpmError('npm error ENEEDAUTH')).toBe(
            'npm error ENEEDAUTH'
        );
    });
});
