import { GENERATED_MARKER } from '@orthacms/schema-builder-domain';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { EditingDisabledError } from '../../domain/errors';
import { EditableGuard } from './editable.guard';

describe('EditableGuard [schema-builder:I-01]', () => {
    const tree = new MemorySourceTree({
        'src/content/index.ts': GENERATED_MARKER
    });
    const guard = (over: { enabled?: boolean; production?: boolean }) =>
        new EditableGuard(
            { enabled: true, production: false, projectRoot: '/app', ...over },
            tree
        );

    it('lets a development server with the flag through', async () => {
        await expect(guard({}).canActivate()).resolves.toBe(true);
    });

    it('refuses production whatever the flag says, with the reason', async () => {
        await expect(
            guard({ production: true }).canActivate()
        ).rejects.toMatchObject({ reason: 'production' });
    });

    it('refuses with the flag off', async () => {
        await expect(
            guard({ enabled: false }).canActivate()
        ).rejects.toBeInstanceOf(EditingDisabledError);
    });

    it('refuses without a source tree', async () => {
        const bare = new EditableGuard(
            { enabled: true, production: false, projectRoot: '/app' },
            new MemorySourceTree()
        );
        await expect(bare.canActivate()).rejects.toMatchObject({
            reason: 'no-source-tree'
        });
    });
});
