import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { FileOperationLog } from './file-operation-log';

describe('FileOperationLog', () => {
    const operation: ApplyOperation = {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'running',
        step: 'generate',
        migrations: [],
        files: [],
        bootId: 'boot',
        startedAt: '2026-01-01T00:00:00.000Z'
    };

    it('keeps the last version of each operation in its own file', async () => {
        const tree = new MemorySourceTree();
        const log = new FileOperationLog(tree);
        await log.save(operation);
        await log.save({ ...operation, status: 'succeeded', step: null });
        expect(Object.keys(tree.files)).toEqual([
            `.orthacms/operations/${operation.id}.json`
        ]);
        await expect(log.get(operation.id)).resolves.toMatchObject({
            status: 'succeeded'
        });
    });

    it('answers null for an unknown id, and never turns a non-uuid into a path', async () => {
        const log = new FileOperationLog(new MemorySourceTree());
        await expect(
            log.get('00000000-0000-4000-8000-000000000009')
        ).resolves.toBeNull();
        await expect(log.get('../../src/content/index')).resolves.toBeNull();
        await expect(log.save({ ...operation, id: '../x' })).rejects.toThrow(
            /Not an operation id/
        );
    });
});
