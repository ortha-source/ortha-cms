import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import { NotFoundException } from '@nestjs/common';
import { MemoryOperationLog } from '../../../testing/fakes';
import { ReadOperationUseCase } from './read-operation.use-case';

describe('ReadOperationUseCase', () => {
    const base: ApplyOperation = {
        id: 'op',
        status: 'running',
        step: 'migrate',
        migrations: [],
        files: [],
        bootId: 'boot-1',
        startedAt: '2026-01-01T00:00:00.000Z'
    };

    async function read(saved: ApplyOperation, bootId: string) {
        const log = new MemoryOperationLog();
        await log.save(saved);
        return new ReadOperationUseCase(log, bootId).execute(saved.id);
    }

    it('answers a running operation of this process as running', async () => {
        await expect(read(base, 'boot-1')).resolves.toMatchObject({
            status: 'running'
        });
    });

    it('answers one left running by another process as interrupted', async () => {
        await expect(read(base, 'boot-2')).resolves.toMatchObject({
            status: 'interrupted',
            step: 'migrate'
        });
    });

    it('answers a finished one as it is, whichever process asks', async () => {
        await expect(
            read({ ...base, status: 'succeeded', step: null }, 'boot-2')
        ).resolves.toMatchObject({ status: 'succeeded' });
    });

    it('404s an unknown id', async () => {
        await expect(
            new ReadOperationUseCase(new MemoryOperationLog(), 'b').execute(
                'nope'
            )
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
