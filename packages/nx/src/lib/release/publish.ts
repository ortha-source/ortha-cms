import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const LARGE_BUFFER = 1024 * 1000000;

export interface NpmPublishRequest {
    /** Where npm runs (the workspace root); the package is passed as a path. */
    cwd: string;
    /** Absolute path to the staged package root that `pack` produced. */
    packageRoot: string;
    registry?: string;
    tag?: string;
    otp?: string | number;
    access?: string;
    dryRun?: boolean;
}

export type PublishOutcome =
    | { status: 'published'; output: string }
    /** The registry already has this exact version — a resumed release. */
    | { status: 'already-published'; output: string }
    /** Worth another try: a 429, a 5xx, or a dropped socket. */
    | { status: 'retryable'; reason: string; output: string }
    | { status: 'failed'; output: string };

export interface RetryOptions {
    /** How many extra attempts a retryable failure gets. */
    retries: number;
    /** Backoff before the first retry, in milliseconds; doubles after that. */
    backoff: number;
    /** Ceiling for the doubling, in milliseconds. */
    maxBackoff: number;
    /** Progress reporting; the executor points this at the console. */
    log: (message: string) => void;
}

/**
 * Publishes one staged package, retrying while the registry is the thing
 * saying no.
 *
 * A rate-limited publish is not a broken package: npm answers 429 when an
 * account writes too fast, and the same tarball succeeds a minute later.
 * Anything else — a bad manifest, a missing entry point, a rejected token —
 * fails on the first attempt, because retrying it only makes the release take
 * five minutes longer to tell you the same thing.
 */
export async function publishWithRetry(
    request: NpmPublishRequest,
    options: RetryOptions
): Promise<PublishOutcome> {
    let backoff = options.backoff;

    for (let attempt = 0; ; attempt++) {
        const outcome = runNpmPublish(request);

        if (outcome.status !== 'retryable') return outcome;

        if (attempt >= options.retries) {
            options.log(
                `giving up after ${attempt + 1} attempts (${outcome.reason})`
            );
            return { status: 'failed', output: outcome.output };
        }

        options.log(
            `${outcome.reason}; retrying in ${Math.ceil(backoff / 1000)}s ` +
                `(attempt ${attempt + 2} of ${options.retries + 1})`
        );

        await sleep(backoff);
        backoff = Math.min(backoff * 2, options.maxBackoff);
    }
}

/**
 * One `npm publish`. Run from the workspace root with the package root as an
 * argument, the way npm expects — publishing with the staging directory as
 * the working directory makes npm read it as a workspace member.
 */
export function runNpmPublish(request: NpmPublishRequest): PublishOutcome {
    const args = ['publish', request.packageRoot, '--json'];

    if (request.registry) args.push(`--registry=${request.registry}`);
    if (request.tag) args.push(`--tag=${request.tag}`);
    if (request.otp) args.push(`--otp=${request.otp}`);
    if (request.access) args.push(`--access=${request.access}`);
    if (request.dryRun) args.push('--dry-run');

    try {
        const output = execFileSync('npm', args, {
            cwd: request.cwd,
            encoding: 'utf8',
            maxBuffer: LARGE_BUFFER,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        return { status: 'published', output };
    } catch (error) {
        const err = error as { stdout?: string; stderr?: string };
        const output = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim();

        if (isAlreadyPublished(output)) {
            return { status: 'already-published', output };
        }

        const reason = retryableReason(output);

        return reason
            ? { status: 'retryable', reason, output }
            : { status: 'failed', output };
    }
}

/**
 * npm rejects a republish of an existing version with 403 EPUBLISHCONFLICT.
 * For us that is success: it is what a release resumed with
 * `npm run release:publish` sees for everything that already went out.
 */
function isAlreadyPublished(output: string): boolean {
    const text = output.toLowerCase();

    return (
        text.includes('epublishconflict') ||
        text.includes(
            'cannot publish over the previously published versions'
        ) ||
        text.includes('you cannot publish over')
    );
}

/** The failures that are about the registry's mood rather than our tarball. */
function retryableReason(output: string): string | null {
    const text = output.toLowerCase();

    if (
        text.includes('429') ||
        text.includes('too many requests') ||
        text.includes('rate limit') ||
        text.includes('eratelimit')
    ) {
        return 'rate limited by the registry';
    }

    // Matched against npm's own wording (`npm error code E503`, `503 Service
    // Unavailable - PUT https://…`) rather than a bare number, which shows up
    // in unrelated output such as file sizes.
    if (
        /\be50[0-9]\b/.test(text) ||
        /\b(500|502|503|504)\s+(internal|bad gateway|service|gateway)/.test(
            text
        )
    ) {
        return 'the registry returned a server error';
    }

    if (
        text.includes('etimedout') ||
        text.includes('econnreset') ||
        text.includes('econnrefused') ||
        text.includes('eai_again') ||
        text.includes('socket hang up') ||
        text.includes('network')
    ) {
        return 'the connection to the registry failed';
    }

    return null;
}

/**
 * Pulls the printed npm error out of `--json` output, for a readable log.
 * The output is stdout and stderr concatenated, so the JSON document is
 * somewhere inside rather than the whole string.
 */
export function formatNpmError(output: string): string {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');

    if (start !== -1 && end > start) {
        try {
            const error = JSON.parse(output.slice(start, end + 1))?.error;

            if (error) {
                return [error.code, error.summary, error.detail]
                    .filter(Boolean)
                    .join('\n');
            }
        } catch {
            // Not JSON after all (npm writes plain text for some failures).
        }
    }

    return output;
}
