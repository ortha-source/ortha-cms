import {
    mkdirSync,
    openSync,
    closeSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

/** Where the cross-process publish lock and its timestamp live. */
export function throttleStateDir(workspaceRoot: string): string {
    return join(workspaceRoot, 'dist', '.release-publish');
}

export interface ThrottleOptions {
    /** Directory holding the lock and the last-publish timestamp. */
    dir: string;
    /** Minimum gap between two publishes, in milliseconds. */
    spacing: number;
    /** Age at which a lock is assumed abandoned and stolen, in milliseconds. */
    staleAfter?: number;
    /** Called once while waiting, so a queued package says why it is idle. */
    onWait?: (reason: string) => void;
}

const POLL_INTERVAL = 250;
const DEFAULT_STALE_AFTER = 15 * 60_000;

/**
 * Runs `publish` as the only publish happening in this workspace, and no
 * sooner than `spacing` milliseconds after the previous one finished.
 *
 * npm rate-limits writes per account, and a lockstep release fires ~37 of
 * them back to back; without a gap the registry starts answering 429 and the
 * release dies half-published. Nx runs `nx-release-publish` as ordinary tasks
 * — in parallel, in forked workers — so the gap cannot be enforced inside one
 * process. Hence a file lock: whoever holds it is publishing, everyone else
 * waits their turn.
 *
 * The lock is held across the spacing wait as well as the publish itself, so
 * the packages queue up rather than all sleeping at once and then racing.
 */
export async function withPublishSlot<T>(
    options: ThrottleOptions,
    publish: () => Promise<T>
): Promise<T> {
    const { dir, spacing, staleAfter = DEFAULT_STALE_AFTER, onWait } = options;
    const lockFile = join(dir, 'lock');
    const stampFile = join(dir, 'last-publish');

    mkdirSync(dir, { recursive: true });

    await acquire(lockFile, staleAfter, onWait);

    try {
        const wait = spacing - (Date.now() - readStamp(stampFile));

        if (wait > 0) {
            onWait?.(`waiting ${Math.ceil(wait / 1000)}s before publishing`);
            await sleep(wait);
        }

        return await publish();
    } finally {
        writeFileSync(stampFile, `${Date.now()}`);
        rmSync(lockFile, { force: true });
    }
}

/**
 * `wx` fails when the file exists, which is the whole mutex. A lock older
 * than `staleAfter` belonged to a worker that died — stealing it is better
 * than wedging every later release.
 */
async function acquire(
    lockFile: string,
    staleAfter: number,
    onWait?: (reason: string) => void
): Promise<void> {
    let announced = false;

    for (;;) {
        try {
            closeSync(openSync(lockFile, 'wx'));
            writeFileSync(lockFile, `${process.pid}`);
            return;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }

        if (age(lockFile) > staleAfter) {
            rmSync(lockFile, { force: true });
            continue;
        }

        if (!announced) {
            announced = true;
            onWait?.('waiting for another package to finish publishing');
        }

        await sleep(POLL_INTERVAL);
    }
}

function age(file: string): number {
    try {
        return Date.now() - statSync(file).mtimeMs;
    } catch {
        // It vanished between the failed create and this check — retry.
        return 0;
    }
}

function readStamp(file: string): number {
    try {
        const value = Number.parseInt(readFileSync(file, 'utf8').trim(), 10);
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}
