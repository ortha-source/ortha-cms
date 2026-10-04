import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ApplyInProgressError } from '../../domain/errors';
import type {
    ApplyLock,
    ReleaseLock
} from '../../domain/ports/apply-lock.port';
import { WORK_DIR } from '../../types/schema-builder-config';

/** Whether a process is still there to hold a lock. */
function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/**
 * [schema-builder:I-05] {@link ApplyLock} as a file created exclusively
 * (`wx`), holding the owner's pid. A lock whose owner is gone — the process
 * that crashed, or restarted mid-apply — is stale and taken over; a live one,
 * this process's included, refuses.
 */
export class FileApplyLock implements ApplyLock {
    private readonly path: string;

    constructor(root: string) {
        this.path = join(root, WORK_DIR, 'apply.lock');
    }

    async acquire(): Promise<ReleaseLock> {
        await mkdir(dirname(this.path), { recursive: true });
        if (!(await this.create())) {
            if (this.ownerAlive(await this.owner()))
                throw new ApplyInProgressError();
            await rm(this.path, { force: true });
            if (!(await this.create())) throw new ApplyInProgressError();
        }
        return () => rm(this.path, { force: true });
    }

    private async create(): Promise<boolean> {
        try {
            const handle = await open(this.path, 'wx');
            await handle.writeFile(
                JSON.stringify({
                    pid: process.pid,
                    at: new Date().toISOString()
                })
            );
            await handle.close();
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST')
                return false;
            throw error;
        }
    }

    private async owner(): Promise<number | null> {
        try {
            return (
                (
                    JSON.parse(await readFile(this.path, 'utf8')) as {
                        pid?: number;
                    }
                ).pid ?? null
            );
        } catch {
            return null;
        }
    }

    private ownerAlive(pid: number | null): boolean {
        return pid !== null && alive(pid);
    }
}
