import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeSourceTree } from './node-source-tree';

describe('NodeSourceTree', () => {
    let root: string;
    let tree: NodeSourceTree;

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), 'sb-tree-'));
        mkdirSync(join(root, 'src/content'), { recursive: true });
        writeFileSync(join(root, 'src/content/index.ts'), '// first\nsecond\n');
        writeFileSync(join(root, 'src/content/crlf.ts'), '// first\r\nsecond');
        writeFileSync(join(root, 'src/content/empty.ts'), '');
        writeFileSync(
            join(root, 'src/content/long.ts'),
            `// ${'x'.repeat(2000)}\nsecond`
        );
        tree = new NodeSourceTree(root);
    });

    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('answers whether a file or a folder exists', async () => {
        await expect(tree.exists('src/content/index.ts')).resolves.toBe(true);
        await expect(tree.exists('src/content')).resolves.toBe(true);
        await expect(tree.exists('src/content/missing.ts')).resolves.toBe(
            false
        );
    });

    it('reads only the first line, whatever the line ending', async () => {
        await expect(tree.firstLine('src/content/index.ts')).resolves.toBe(
            '// first'
        );
        await expect(tree.firstLine('src/content/crlf.ts')).resolves.toBe(
            '// first'
        );
        await expect(tree.firstLine('src/content/empty.ts')).resolves.toBe('');
    });

    it('reads no further than its head — a marker line is short', async () => {
        const line = await tree.firstLine('src/content/long.ts');
        expect(line?.startsWith('// xxx')).toBe(true);
        expect(line?.length).toBeLessThan(2000);
    });

    it('reads a missing file as null', async () => {
        await expect(
            tree.firstLine('src/content/missing.ts')
        ).resolves.toBeNull();
    });

    it('refuses a path outside the root', async () => {
        // `exists` and `firstLine` swallow I/O errors, never the refusal's
        // reason: an escape reads as absent, so nothing outside is touched.
        await expect(tree.exists('../outside.ts')).resolves.toBe(false);
        await expect(tree.firstLine('/etc/hostname')).resolves.toBeNull();
        await expect(
            tree.firstLine('src/../../etc/hostname')
        ).resolves.toBeNull();
    });
});
