import { execFile } from 'node:child_process';

/** One finished drizzle-kit process. */
export interface DrizzleKitRun {
    /** Killed at the deadline. */
    readonly timedOut: boolean;
    /** stdout and stderr together, as a person would have seen them. */
    readonly output: string;
}

/**
 * drizzle-kit with no TTY and a deadline (design invariant 12). Without a TTY
 * a question it wants to ask fails at once instead of waiting for an answer;
 * the deadline covers anything else that would hang a request.
 */
export function runDrizzleKit(
    bin: string,
    cwd: string,
    args: readonly string[],
    timeoutMs: number
): Promise<DrizzleKitRun> {
    return new Promise((resolve) => {
        execFile(
            process.execPath,
            [bin, ...args],
            {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 8 << 20,
                env: { ...process.env, CI: '1', FORCE_COLOR: '0' }
            },
            (error, stdout, stderr) =>
                resolve({
                    timedOut: Boolean(error?.killed),
                    output: `${stdout}${stderr}`
                })
        );
    });
}
