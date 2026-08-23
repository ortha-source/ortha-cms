import { execFileSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * `tools/release/pack.mjs` staging a package that ships a **`bin`** and
 * **`templates/`** — what `create-ortha-app` and `@orthacms/cli` need.
 *
 * Driven as a subprocess against a throwaway workspace rather than imported:
 * the script is an ESM entry point that reads `process.cwd()`, writes to
 * `dist/pack/`, and calls `process.exit` on failure. Running it for real is
 * also the only way to catch the failure this exists for — a `bin` left
 * pointing at `./src/cli.ts`, which installs cleanly and only breaks at
 * someone else's `npx`.
 */
const packScript = join(__dirname, '../../../../../tools/release/pack.mjs');

let root: string;

/** Writes `value` as JSON at `path`, creating parent directories. */
function writeJson(path: string, value: unknown): void {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
}

/** Writes a text file at `path`, creating parent directories. */
function writeText(path: string, contents: string): void {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, contents);
}

/**
 * Lays down a workspace holding one already-"built" package, so `pack.mjs`
 * finds the root manifest, the LICENSE and a `dist/` the way it would in the
 * real repo.
 */
function workspace(manifest: Record<string, unknown>): string {
    const dir = mkdtempSync(join(tmpdir(), 'ortha-pack-'));

    writeJson(join(dir, 'package.json'), {
        name: '@orthacms/source',
        license: 'MIT',
        repository: {
            type: 'git',
            url: 'git+https://github.com/ortha-source/ortha-cms.git'
        },
        devDependencies: { tslib: '^2.3.0' }
    });
    writeText(join(dir, 'LICENSE'), 'MIT');

    const project = join(dir, 'packages/scaffolder');
    writeJson(join(project, 'package.json'), manifest);
    writeText(join(project, 'dist/cli.js'), '#!/usr/bin/env node\n');
    writeText(join(project, 'dist/index.js'), 'exports.x = 1;\n');
    writeText(
        join(project, 'dist/index.d.ts'),
        'export declare const x = 1;\n'
    );

    return dir;
}

/** Runs `pack.mjs` for the fixture project inside `root`. */
function pack(): void {
    execFileSync(process.execPath, [packScript, 'packages/scaffolder'], {
        cwd: root,
        stdio: 'pipe'
    });
}

/** The manifest `pack.mjs` staged for the fixture project. */
function stagedManifest(): Record<string, never> {
    return JSON.parse(
        readFileSync(
            join(root, 'dist/pack/packages/scaffolder/package.json'),
            'utf8'
        )
    );
}

const baseManifest = {
    name: 'create-ortha-app',
    version: '1.2.3',
    main: './src/index.ts',
    types: './src/index.ts',
    exports: {
        '.': {
            types: './src/index.ts',
            default: './src/index.ts'
        }
    }
};

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('pack.mjs, for a package that ships a bin', () => {
    it('remaps a bin map onto the build output', () => {
        root = workspace({ ...baseManifest, bin: { ortha: './src/cli.ts' } });

        pack();

        expect(stagedManifest().bin).toEqual({ ortha: './dist/cli.js' });
    });

    it('remaps the bare-string spelling too', () => {
        root = workspace({ ...baseManifest, bin: './src/cli.ts' });

        pack();

        expect(stagedManifest().bin).toBe('./dist/cli.js');
    });

    it('leaves the manifest without a bin when the package has none', () => {
        root = workspace(baseManifest);

        pack();

        expect(stagedManifest()).not.toHaveProperty('bin');
    });

    /**
     * The regression this file exists for. Unremapped, npm links
     * `./src/cli.ts` — absent from the tarball, since `files` is `dist` — and
     * the command fails only at `npx`, on a consumer's machine.
     */
    it('refuses to stage a bin the build never emitted', () => {
        root = workspace({
            ...baseManifest,
            bin: { ortha: './src/missing.ts' }
        });

        expect(pack).toThrow();
    });
});

describe('pack.mjs, for a package that ships templates', () => {
    /** Adds a `templates/` tree to the fixture project. */
    function withTemplates(): void {
        writeText(
            join(root, 'packages/scaffolder/templates/base/package.json.tmpl'),
            '{ "name": "__NAME__" }\n'
        );
    }

    it('carries templates/ into the tarball', () => {
        root = workspace(baseManifest);
        withTemplates();

        pack();

        expect(
            readFileSync(
                join(
                    root,
                    'dist/pack/packages/scaffolder/templates/base/package.json.tmpl'
                ),
                'utf8'
            )
        ).toContain('__NAME__');
    });

    it('lists templates/ in `files`, so npm actually publishes it', () => {
        root = workspace(baseManifest);
        withTemplates();

        pack();

        expect(stagedManifest().files).toEqual(['dist', 'templates']);
    });

    it('lists only dist when the package ships no templates', () => {
        root = workspace(baseManifest);

        pack();

        expect(stagedManifest().files).toEqual(['dist']);
    });
});
