import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * What the admin host is allowed to know about.
 *
 * Both claims are about what is **absent**, which no rendered page can show: an
 * app assembled with the shell and identity present behaves identically whether
 * the host imports them or not. They are also the two the host is most likely to
 * lose, because in both cases the import that breaks them is the convenient move
 * in the moment — reading a slot to render one nav item, importing `useAuth` to
 * skip a redirect.
 */

// Resolved off `import.meta.url` as a string. Under the jsdom environment the
// global `URL` is jsdom's, and node's `fileURLToPath` refuses an instance it did
// not make ("The URL must be of scheme file").
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Every TypeScript source file in the package, specs and setup excluded. */
function sourceFiles(dir = join(PACKAGE_ROOT, 'src')): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        if (!/\.tsx?$/.test(path)) return [];
        if (/\.spec\.tsx?$/.test(path) || path.endsWith('test-setup.ts')) {
            return [];
        }
        return [path];
    });
}

/** Source files whose text matches `pattern`, relative to the package. */
function matching(pattern: RegExp): string[] {
    return sourceFiles()
        .filter((file) => pattern.test(readFileSync(file, 'utf8')))
        .map((file) => relative(PACKAGE_ROOT, file));
}

describe('the admin host’s boundaries', () => {
    it('wires slots without defining or reading one [bootstrap:I-24]', () => {
        // The positive half first, so this cannot pass by the host having
        // stopped touching slots altogether: it does wire them, in one call,
        // and that call is the entirety of its involvement.
        expect(matching(/wireSlotContributions/)).toEqual([
            'src/lib/createAdmin/index.tsx'
        ]);

        // All 26 slots belong to plugins. A host that defined one would be
        // declaring that the application has a sidebar — which is the shell's
        // claim to make, and the reason a deployment can drop the shell and
        // still boot.
        expect(matching(/\bcreateSlot\b/)).toEqual([]);
        // Reading one is the subtler failure: it makes the host depend on a
        // contribution's shape, so a plugin can no longer change its own items
        // without the composition root agreeing.
        expect(matching(/\.getItems\s*\(/)).toEqual([]);
    });

    it('imports no authorization package at all [bootstrap:I-35]', () => {
        const manifest = JSON.parse(
            readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')
        ) as Record<string, Record<string, string> | undefined>;

        const declared = Object.keys({
            ...manifest['dependencies'],
            ...manifest['peerDependencies'],
            ...manifest['devDependencies']
        });
        // Not a dependency, not even a dev one. The gate lives in the `layout`
        // the shell contributes, and the host mounts that layout without knowing
        // what is inside it — which is what lets an installation replace or omit
        // the gate without touching `packages/bootstrap`.
        expect(declared).not.toContain('@orthacms/identity-admin');

        expect(matching(/@orthacms\/identity-admin/)).toEqual([]);
        // The three words the dossier names, as imported symbols rather than
        // prose: `createAdmin`'s comments discuss `RequireAuth` at length, and
        // must go on being able to.
        expect(
            matching(
                /import[\s\S]{0,200}?\b(RequireAuth|AuthProvider|useAuth)\b/
            )
        ).toEqual([]);
    });
});
