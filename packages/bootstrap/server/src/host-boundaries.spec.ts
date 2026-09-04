import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the server host is allowed to know about.
 *
 * These are claims about the package's *shape* rather than its behaviour, so
 * nothing a request can do will ever fail on them — and they are exactly the
 * kind that decays quietly, because adding the import that breaks one is always
 * the convenient move in the moment.
 */

const PACKAGE_ROOT = join(__dirname, '..');

/** Every TypeScript source file in the package, specs excluded. */
function sourceFiles(dir = join(PACKAGE_ROOT, 'src')): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        if (!path.endsWith('.ts') || path.endsWith('.spec.ts')) return [];
        return [path];
    });
}

describe('the server host’s dependencies', () => {
    it('does not depend on express, and names its request types structurally [bootstrap:I-36]', () => {
        const manifest = JSON.parse(
            readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')
        ) as Record<string, Record<string, string> | undefined>;

        const declared = Object.keys({
            ...manifest['dependencies'],
            ...manifest['peerDependencies'],
            ...manifest['devDependencies']
        });
        // Express is reached only through `@nestjs/platform-express`. Declaring
        // it here — or, worse, importing it without declaring it — makes it a
        // phantom dependency: resolvable in this workspace because npm hoists
        // it to the root, absent from a consumer's tree, and refused at publish
        // time by `pack.mjs`'s `verifyDependenciesAreDeclared`.
        expect(declared).not.toContain('express');
        expect(declared).not.toContain('@types/express');

        // `serve-admin.ts` declares the two-method slices of express's request
        // and response it touches (`StaticRequest` / `StaticResponse`) rather
        // than importing the types. This is the assertion that fails the moment
        // someone reaches for `import type { Request } from 'express'` because
        // the structural interface was one property short.
        const importsExpress = sourceFiles().filter((file) =>
            /(from|require\()\s*['"]express['"]/.test(
                readFileSync(file, 'utf8')
            )
        );
        expect(importsExpress).toEqual([]);
    });
});
