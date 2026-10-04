import { GENERATED_MARKER } from '@orthacms/schema-builder-domain';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { readOrigin } from './read-origin';

describe('readOrigin', () => {
    const tree = new MemorySourceTree({
        'src/content/collections/owned.ts': `${GENERATED_MARKER}\nexport {};`,
        'src/content/collections/hand.ts': '// written by a person\nexport {};',
        'src/content/pages/home.ts': `${GENERATED_MARKER}\r\nexport {};`,
        'src/content/collections/late.ts': `import x from 'y';\n${GENERATED_MARKER}`
    });

    it('is the builder when the first line is the marker', async () => {
        await expect(
            readOrigin(tree, 'src/content', {
                name: 'owned',
                kind: 'collection'
            })
        ).resolves.toBe('builder');
        await expect(
            readOrigin(tree, 'src/content', { name: 'home', kind: 'single' })
        ).resolves.toBe('builder');
    });

    it('is code for a file without it, or with it anywhere but the first line', async () => {
        await expect(
            readOrigin(tree, 'src/content', {
                name: 'hand',
                kind: 'collection'
            })
        ).resolves.toBe('code');
        await expect(
            readOrigin(tree, 'src/content', {
                name: 'late',
                kind: 'collection'
            })
        ).resolves.toBe('code');
    });

    it('is code when there is no file at the conventional path', async () => {
        await expect(
            readOrigin(tree, 'src/content', {
                name: 'missing',
                kind: 'collection'
            })
        ).resolves.toBe('code');
    });

    it('looks under the folder for its kind', async () => {
        await expect(
            readOrigin(tree, 'src/content', {
                name: 'home',
                kind: 'collection'
            })
        ).resolves.toBe('code');
    });
});
