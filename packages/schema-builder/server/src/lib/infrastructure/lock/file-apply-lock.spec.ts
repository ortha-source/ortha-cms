import {
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
    existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplyInProgressError } from '../../domain/errors';
import { FileApplyLock } from './file-apply-lock';

describe('FileApplyLock [schema-builder:I-05]', () => {
    let root: string;
    const lockFile = () => join(root, '.orthacms/apply.lock');

    beforeEach(() => (root = mkdtempSync(join(tmpdir(), 'sb-lock-'))));
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('takes a free lock and gives it back', async () => {
        const release = await new FileApplyLock(root).acquire();
        expect(existsSync(lockFile())).toBe(true);
        await release();
        expect(existsSync(lockFile())).toBe(false);
    });

    it('refuses while a live process — this one included — holds it', async () => {
        const lock = new FileApplyLock(root);
        const release = await lock.acquire();
        await expect(lock.acquire()).rejects.toBeInstanceOf(
            ApplyInProgressError
        );
        await expect(new FileApplyLock(root).acquire()).rejects.toBeInstanceOf(
            ApplyInProgressError
        );
        await release();
        await expect(lock.acquire()).resolves.toEqual(expect.any(Function));
    });

    it('takes over a lock whose owner is gone — the process that crashed or restarted', async () => {
        mkdirSync(join(root, '.orthacms'), { recursive: true });
        writeFileSync(
            lockFile(),
            JSON.stringify({ pid: 2 ** 22 + 12345, at: '2026-01-01T00:00:00Z' })
        );
        await expect(new FileApplyLock(root).acquire()).resolves.toEqual(
            expect.any(Function)
        );
    });

    it('takes over a lock file it cannot read', async () => {
        mkdirSync(join(root, '.orthacms'), { recursive: true });
        writeFileSync(lockFile(), 'not json');
        await expect(new FileApplyLock(root).acquire()).resolves.toEqual(
            expect.any(Function)
        );
    });
});
