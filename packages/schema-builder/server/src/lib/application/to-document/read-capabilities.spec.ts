import { GENERATED_MARKER } from '@orthacms/schema-builder-domain';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import type { SchemaBuilderPluginConfig } from '../../types/schema-builder-config';
import { readCapabilities } from './read-capabilities';

const withTree = new MemorySourceTree({
    'src/content/index.ts': `${GENERATED_MARKER} — the content manifest.`
});
const handManifest = new MemorySourceTree({
    'src/content/index.ts': "import { x } from './x';"
});
const noTree = new MemorySourceTree();
const config = (
    over: Partial<SchemaBuilderPluginConfig> = {}
): SchemaBuilderPluginConfig => ({
    enabled: true,
    production: false,
    projectRoot: '/app',
    ...over
});

describe('readCapabilities', () => {
    it('is editable when enabled, outside production, with a manifest', async () => {
        await expect(
            readCapabilities(withTree, config(), 'src/content')
        ).resolves.toEqual({
            editable: true,
            restart: 'watch'
        });
    });

    it('refuses production whatever the flag says [ADR-0020]', async () => {
        await expect(
            readCapabilities(
                withTree,
                config({ production: true }),
                'src/content'
            )
        ).resolves.toEqual({
            editable: false,
            reason: 'production',
            restart: 'watch'
        });
    });

    it('reports production before disabled — the stronger reason wins', async () => {
        await expect(
            readCapabilities(
                withTree,
                config({ production: true, enabled: false }),
                'src/content'
            )
        ).resolves.toMatchObject({ reason: 'production' });
    });

    it('is off when the flag is off', async () => {
        await expect(
            readCapabilities(
                withTree,
                config({ enabled: false }),
                'src/content'
            )
        ).resolves.toMatchObject({
            editable: false,
            reason: 'disabled'
        });
    });

    it('is off without a manifest to write to', async () => {
        await expect(
            readCapabilities(noTree, config(), 'src/content')
        ).resolves.toMatchObject({
            editable: false,
            reason: 'no-source-tree'
        });
        await expect(
            readCapabilities(withTree, config(), 'lib/content')
        ).resolves.toMatchObject({
            reason: 'no-source-tree'
        });
    });

    it('is off when the manifest was written by hand — every apply rewrites it', async () => {
        await expect(
            readCapabilities(handManifest, config(), 'src/content')
        ).resolves.toMatchObject({
            editable: false,
            reason: 'hand-written-manifest'
        });
    });

    it('passes the restart mode through', async () => {
        await expect(
            readCapabilities(
                withTree,
                config({ restart: 'manual' }),
                'src/content'
            )
        ).resolves.toMatchObject({
            restart: 'manual'
        });
    });
});
