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

describe('NodeSourceTree writes', () => {
    let root: string;
    let tree: NodeSourceTree;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'sb-write-'));
        mkdirSync(join(root, 'src/content/collections'), { recursive: true });
        writeFileSync(join(root, 'src/content/index.ts'), 'manifest');
        writeFileSync(join(root, 'src/content/collections/a.ts'), 'a');
        tree = new NodeSourceTree(root);
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('reads a whole file, and a missing one as null', async () => {
        await expect(tree.read('src/content/index.ts')).resolves.toBe(
            'manifest'
        );
        await expect(tree.read('src/content/none.ts')).resolves.toBeNull();
    });

    it('lists the files directly in a folder, sorted, and a missing folder as empty', async () => {
        await expect(tree.list('src/content')).resolves.toEqual(['index.ts']);
        await expect(tree.list('nowhere')).resolves.toEqual([]);
    });

    it('writes a file, creating its folders', async () => {
        await tree.write('.orthacms/plan/x/deep/file.ts', 'text');
        await expect(tree.read('.orthacms/plan/x/deep/file.ts')).resolves.toBe(
            'text'
        );
    });

    it('copies a folder recursively, and a missing one as an empty folder', async () => {
        await tree.copyDir('src/content', '.orthacms/stage');
        await expect(
            tree.read('.orthacms/stage/collections/a.ts')
        ).resolves.toBe('a');
        await tree.copyDir('migrations', '.orthacms/m');
        await expect(tree.exists('.orthacms/m')).resolves.toBe(true);
    });

    it('removes recursively, and removing nothing is fine', async () => {
        await tree.remove('src/content');
        await expect(tree.exists('src/content')).resolves.toBe(false);
        await expect(tree.remove('src/content')).resolves.toBeUndefined();
    });

    it('refuses to write, copy or remove outside the root — or the root itself', async () => {
        await expect(tree.write('../escape.ts', 'x')).rejects.toThrow(
            /not inside/
        );
        await expect(tree.copyDir('src', '../../copy')).rejects.toThrow(
            /not inside/
        );
        await expect(tree.remove('.')).rejects.toThrow(/not inside/);
        await expect(tree.remove('/tmp')).rejects.toThrow(/not inside/);
    });
});
