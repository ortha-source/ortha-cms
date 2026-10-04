import type { ContentTypeRegistry } from '@orthacms/content-server';
import { fingerprint, GENERATED_MARKER } from '@orthacms/schema-builder-domain';
import { MemorySourceTree } from '../../testing/memory-source-tree';
import { TYPES } from '../../testing/types';
import { LoadDocumentUseCase } from './load-document.use-case';

const registry = { all: () => TYPES } as unknown as ContentTypeRegistry;
const tree = new MemorySourceTree({
    'lib/content/index.ts': GENERATED_MARKER,
    'lib/content/collections/sb_post.ts': `${GENERATED_MARKER}\n`
});

describe('LoadDocumentUseCase', () => {
    it('reads the registry, ownership from the configured folder, and fingerprints the result', async () => {
        const useCase = new LoadDocumentUseCase(
            registry,
            tree,
            {
                enabled: true,
                production: false,
                projectRoot: '/app',
                contentDir: 'lib/content'
            },
            'boot-1'
        );
        const envelope = await useCase.execute();

        expect(envelope.bootId).toBe('boot-1');
        expect(envelope.capabilities).toEqual({
            editable: true,
            restart: 'watch'
        });
        expect(
            envelope.document.types.map((type) => [type.name, type.origin])
        ).toEqual([
            ['sb_author', 'code'],
            ['sb_post', 'builder'],
            ['sb_home', 'code']
        ]);
        expect(envelope.fingerprint).toBe(fingerprint(envelope.document));
    });

    it('defaults to src/content', async () => {
        const useCase = new LoadDocumentUseCase(
            registry,
            tree,
            { enabled: true, production: false, projectRoot: '/app' },
            'boot-1'
        );
        const envelope = await useCase.execute();

        expect(envelope.capabilities).toMatchObject({
            reason: 'no-source-tree'
        });
        expect(
            envelope.document.types.every((type) => type.origin === 'code')
        ).toBe(true);
    });
});
