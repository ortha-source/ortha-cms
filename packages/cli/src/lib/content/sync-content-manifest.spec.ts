import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncContentManifest } from './sync-content-manifest';

/** A loader that "imports" a file by reading the type it names from a table. */
const loaderFor = (types: Record<string, unknown>) => async (path: string) => {
    const name = path.split('/').pop()!.replace(/\.ts$/, '');
    return name in types ? { [name]: types[name] } : {};
};

describe('syncContentManifest', () => {
    let dir: string;
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'content-sync-'));
        mkdirSync(join(dir, 'collections'));
        mkdirSync(join(dir, 'pages'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const touch = (path: string) =>
        writeFileSync(join(dir, path), '// a type module');

    it('writes the manifest for every type module, ignoring specs', async () => {
        touch('collections/tag.ts');
        touch('collections/tag.spec.ts');
        touch('pages/home.ts');
        const load = loaderFor({
            tag: { kind: 'collection', fields: {} },
            home: { kind: 'single', fields: {} }
        });

        await expect(syncContentManifest(dir, load)).resolves.toEqual({
            count: 2,
            changed: true
        });
        const manifest = readFileSync(join(dir, 'index.ts'), 'utf8');
        expect(manifest).toContain("import { tag } from './collections/tag';");
        expect(manifest).toContain("import { home } from './pages/home';");
        expect(manifest).not.toContain('spec');
    });

    it('leaves an up-to-date manifest untouched', async () => {
        touch('collections/tag.ts');
        const load = loaderFor({ tag: { kind: 'collection', fields: {} } });
        await syncContentManifest(dir, load);
        await expect(syncContentManifest(dir, load)).resolves.toEqual({
            count: 1,
            changed: false
        });
    });

    it('stops on any module that breaks the convention, writing nothing', async () => {
        touch('collections/post.ts');
        await expect(syncContentManifest(dir, loaderFor({}))).rejects.toThrow(
            'content sync stopped:\n  - collections/post.ts does not export a content type named "post".'
        );
        expect(() => readFileSync(join(dir, 'index.ts'))).toThrow();
    });

    it('says so when the content folder does not exist', async () => {
        await expect(
            syncContentManifest(join(dir, 'nope'), loaderFor({}))
        ).rejects.toThrow(/does not exist/);
    });
});
