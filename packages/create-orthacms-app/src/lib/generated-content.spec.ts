import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    statSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { renderTemplate, type TemplateValues } from './template';

/**
 * The generated app's **content model**, checked against the code that owns
 * each half of it.
 *
 * A generated app ships with no content types but with everything a first one
 * needs: the manifest `orthacms content sync` and the schema builder rewrite,
 * the two folders they scan, a drizzle config, and a baseline migration. Each
 * of those is a copy of something another package decides — the manifest's
 * text is `renderManifest`'s, the baseline is what drizzle-kit makes of that
 * manifest, and three places (the drizzle config, `ContentPlugin`'s migrations
 * descriptor and the builder's defaults) have to name one migrations folder.
 * A copy drifts silently, and every one of these drifts surfaces far from here:
 * a first `content sync` that rewrites a file nobody touched, a first
 * `orthacms generate` whose migration also alters a table the user never
 * defined, or a builder that writes SQL `orthacms migrate` never reads.
 *
 * So nothing below restates the expected text. It is computed, by the function
 * or the tool that owns it, and compared with what the template ships.
 */

const TEMPLATE = join(__dirname, '../../templates/default');
const workspaceRoot = join(__dirname, '../../../..');

/** A workspace package's root, through its `node_modules` link. */
function packageRoot(name: string): string {
    return realpathSync(join(workspaceRoot, 'node_modules', name));
}

/** A source file of a workspace package. */
function sourceOf(name: string, path: string): string {
    return readFileSync(join(packageRoot(name), path), 'utf8');
}

/** A `LAYOUT` entry from the CLI — the app conventions it will not negotiate. */
function cliLayout(key: string): string {
    const source = sourceOf('@orthacms/cli', 'src/lib/project.ts');
    const match = new RegExp(`\\n    ${key}: '([^']+)'`).exec(source);

    if (!match) throw new Error(`LAYOUT has no ${key}`);

    return match[1] as string;
}

/** A `DEFAULT_*` constant from the schema builder's config type. */
function builderDefault(name: string): string {
    const source = sourceOf(
        '@orthacms/schema-builder-server',
        'src/lib/types/schema-builder-config.ts'
    );
    const match = new RegExp(`export const ${name} = '([^']+)'`).exec(source);

    if (!match) throw new Error(`schema-builder-server has no ${name}`);

    return match[1] as string;
}

let target: string;

beforeAll(() => {
    // Inside the package rather than in a system temp directory: drizzle-kit
    // below loads the rendered manifest, which imports
    // `@orthacms/content-server/define` — and that only resolves by walking up
    // to this workspace's `node_modules`.
    target = mkdtempSync(join(__dirname, '../../.rendered-content-'));
    const values: TemplateValues = {
        appName: 'my-cms',
        appTitle: 'My CMS',
        databaseUrl: 'postgresql://orthacms:orthacms@localhost:5432/my_cms',
        databaseName: 'my_cms',
        adminEmail: 'admin@example.com',
        adminPassword: 'hunter2',
        orthacmsVersion: '9.9.9',
        selection: { enabled: new Set(['media-local', 'rest']) }
    };
    renderTemplate(TEMPLATE, target, values);
});

afterAll(() => rmSync(target, { recursive: true, force: true }));

/** A rendered file, read back. */
function rendered(path: string): string {
    return readFileSync(join(target, path), 'utf8');
}

/** The `schema` / `out` the shipped drizzle config names. */
function drizzleConfig(): { schema: string; out: string } {
    const source = rendered(cliLayout('drizzleConfig'));
    const schema = /\n\s+schema: '([^']+)'/.exec(source);
    const out = /\n\s+out: '([^']+)'/.exec(source);

    if (!schema || !out) {
        throw new Error('the shipped drizzle config names no schema or out');
    }

    return { schema: schema[1] as string, out: out[1] as string };
}

describe('the generated content manifest', () => {
    /**
     * `orthacms content sync` and the schema builder both rewrite this file
     * from `renderManifest`, and the builder reads a hand-written one as
     * "not mine" and refuses to edit. So the shipped file has to be exactly
     * what the renderer writes for zero types — computed here by the renderer
     * itself, so a change to its header or its imports fails this rather than
     * a new user's first sync.
     */
    it('is exactly what content sync writes for no types [create-orthacms-app:I-36]', () => {
        // Loaded by path, at run time: the scaffolder has no build-time
        // dependency on the kernel and should not grow one for a test.
        const kernel = packageRoot('@orthacms/schema-builder-domain');
        const { renderManifest } = require(kernel) as {
            renderManifest: (entries: readonly unknown[]) => string;
        };

        expect(rendered(`${cliLayout('contentDir')}/index.ts`)).toBe(
            renderManifest([])
        );
    });

    it('ships the two folders a type file goes in', () => {
        for (const folder of ['collections', 'pages']) {
            const path = join(target, cliLayout('contentDir'), folder);

            expect(existsSync(path) && statSync(path).isDirectory()).toBe(true);
        }
    });

    it('is compiled into the server, and the drizzle config is not', () => {
        const tsconfig = JSON.parse(rendered('apps/server/tsconfig.json')) as {
            include: string[];
            exclude: string[];
        };

        // `**/*.ts` from `apps/server` is what reaches `src/content/`.
        expect(tsconfig.include).toContain('**/*.ts');
        // It imports `drizzle-kit`, which the running server has no use for.
        expect(tsconfig.exclude).toContain('drizzle.config.ts');
    });
});

/**
 * The manifest, and every type file the builder writes, imports the DSL from
 * `@orthacms/content-server/define` — a **subpath export**. TypeScript's
 * `node` (node10) resolution ignores `exports` entirely, and the published
 * package has no other way to reach that file, so under it `orthacms build`
 * fails with TS2307 on a freshly generated app. Every project that compiles or
 * typechecks the server's source has to resolve the way Node does.
 */
describe('the server-side TypeScript projects', () => {
    it.each([
        'apps/server/tsconfig.json',
        'apps/server/tsconfig.spec.json',
        'apps/server-e2e/tsconfig.json'
    ])(
        '%s resolves package subpath exports [create-orthacms-app:I-37]',
        (path) => {
            const { compilerOptions } = JSON.parse(rendered(path)) as {
                compilerOptions: { module: string; moduleResolution: string };
            };

            expect(compilerOptions.moduleResolution).toBe('node16');
            // `node16` resolution is only accepted beside `node16` module output,
            // which still emits CommonJS for this `"type": "commonjs"` app.
            expect(compilerOptions.module).toBe('node16');
        }
    );

    /**
     * And the one construct that resolution changes the meaning of: an
     * `import()` in a CommonJS file resolves as ESM, which needs a file
     * extension a relative `.ts` import does not have.
     */
    it('leaves no relative dynamic import in the server-side source', () => {
        // A type query (`typeof import('…')`) resolves in the file's own
        // mode, so it is not one of them.
        const dynamicImport = /(?<!typeof )\bimport\(\s*'\./;
        const offenders = [
            'apps/server-e2e/src/global-setup.ts',
            'apps/server/src/main.ts',
            'apps/server/src/plugins.ts'
        ].filter((path) => dynamicImport.test(rendered(path)));

        expect(offenders).toEqual([]);
    });
});

/**
 * `drizzle.config.ts` imports `drizzle-kit`, so the app declares it — and at
 * the range the CLI and the builder were built against. The builder resolves
 * drizzle-kit from the app first and reads its prompts by their wording, so a
 * second, different copy is not a harmless duplicate.
 */
describe('drizzle-kit', () => {
    it('is declared at the range the CLI and the builder depend on', () => {
        const range = (name: string): string | undefined =>
            (
                JSON.parse(
                    readFileSync(
                        join(packageRoot(name), 'package.json'),
                        'utf8'
                    )
                ) as { dependencies: Record<string, string> }
            ).dependencies['drizzle-kit'];
        const { devDependencies } = JSON.parse(rendered('package.json')) as {
            devDependencies: Record<string, string>;
        };

        expect(rendered(cliLayout('drizzleConfig'))).toContain(
            "from 'drizzle-kit'"
        );
        expect(devDependencies['drizzle-kit']).toBe(range('@orthacms/cli'));
        expect(devDependencies['drizzle-kit']).toBe(
            range('@orthacms/schema-builder-server')
        );
    });
});

describe('the shipped migrations folder', () => {
    /** The folder, as the drizzle config names it from the app root. */
    const migrations = (): string => join(target, drizzleConfig().out);

    /**
     * drizzle's migrator reads `meta/_journal.json` before anything else, and
     * a descriptor pointing at a folder without one fails `orthacms migrate` on
     * an app that has not done anything yet.
     */
    it('carries a journal whose every entry has its SQL', () => {
        const journal = JSON.parse(
            readFileSync(join(migrations(), 'meta/_journal.json'), 'utf8')
        ) as { dialect: string; entries: { idx: number; tag: string }[] };

        expect(journal.dialect).toBe('postgresql');
        expect(journal.entries.length).toBeGreaterThan(0);
        for (const { idx, tag } of journal.entries) {
            expect(existsSync(join(migrations(), `${tag}.sql`))).toBe(true);
            expect(
                existsSync(
                    join(
                        migrations(),
                        `meta/${String(idx).padStart(4, '0')}_snapshot.json`
                    )
                )
            ).toBe(true);
        }
    });

    /**
     * The baseline is drizzle-kit's own output for the empty manifest, and the
     * only way to know it still is, is to ask drizzle-kit. If content-server
     * changes the revision table the manifest re-exports, this fails here —
     * rather than in the first migration a new user generates, which would
     * otherwise carry an `ALTER` of a table they never defined.
     *
     * drizzle-kit exits 0 on a schema it could not load, so the verdict is read
     * from what it printed, not from the exit code.
     */
    it('is what drizzle-kit generates from the manifest, with nothing left over [create-orthacms-app:I-36]', () => {
        const before = readdirSync(migrations()).sort();
        const bin = join(dirname(require.resolve('drizzle-kit')), 'bin.cjs');
        const run = spawnSync(
            process.execPath,
            [bin, 'generate', `--config=${cliLayout('drizzleConfig')}`],
            // The app root, as `orthacms generate` runs it.
            { cwd: target, encoding: 'utf8' }
        );
        const output = `${run.stdout}\n${run.stderr}`;

        expect(output).toContain('content_entry_revisions');
        expect(output).toMatch(/No schema changes/);
        expect(readdirSync(migrations()).sort()).toEqual(before);
    }, 60_000);
});

describe('the content migrations folder, as three places name it', () => {
    /**
     * `orthacms generate` writes to the drizzle config's `out`, resolved from
     * the app root. `orthacms migrate` reads `ContentPlugin`'s descriptor,
     * resolved from wherever `plugins.ts` runs — `apps/server/src` from source,
     * as the tests import it, and the compiled `dist/server/src` when the CLI
     * loads it. The schema builder writes to its own `projectRoot` plus
     * `migrations`. Four readings of one folder; any one of them wrong and the
     * SQL is written where nothing applies it.
     */
    it('is one folder for generate, migrate (source and compiled) and the builder [create-orthacms-app:I-36]', () => {
        const root = '/srv/my-cms';
        const expected = resolve(root, drizzleConfig().out);

        const descriptor = /dir: \(\) => join\(__dirname, '([^']+)'\)/.exec(
            rendered('apps/server/src/plugins.ts')
        );
        expect(descriptor).not.toBeNull();
        const relative = (descriptor as RegExpExecArray)[1] as string;

        // From source…
        expect(resolve(root, 'apps/server/src', relative)).toBe(expected);
        // …and compiled, next to the entry the CLI loads.
        expect(
            resolve(root, dirname(cliLayout('compiledPlugins')), relative)
        ).toBe(expected);

        const builderRoot = /SCHEMA_BUILDER_ROOT'\) \?\? '([^']+)'/.exec(
            rendered('apps/server/config/schema-builder.ts')
        );
        expect(builderRoot).not.toBeNull();
        expect(
            resolve(
                root,
                (builderRoot as RegExpExecArray)[1] as string,
                builderDefault('DEFAULT_MIGRATIONS_DIR')
            )
        ).toBe(expected);
    });

    it('agrees on the manifest the builder edits and drizzle-kit reads', () => {
        const root = '/srv/my-cms';
        const builderRoot = /SCHEMA_BUILDER_ROOT'\) \?\? '([^']+)'/.exec(
            rendered('apps/server/config/schema-builder.ts')
        ) as RegExpExecArray;

        expect(resolve(root, drizzleConfig().schema)).toBe(
            resolve(root, cliLayout('contentDir'), 'index.ts')
        );
        expect(
            resolve(
                root,
                builderRoot[1] as string,
                builderDefault('DEFAULT_CONTENT_DIR')
            )
        ).toBe(resolve(root, cliLayout('contentDir')));
    });

    /** drizzle-kit resolves both from the root, so neither may climb out of it. */
    it('keeps both drizzle paths inside the app', () => {
        const root = '/srv/my-cms';
        const { schema, out } = drizzleConfig();

        for (const path of [schema, out]) {
            expect(resolve(root, path).startsWith(`${root}/`)).toBe(true);
        }
    });

    /**
     * The tracking table is the other half of the descriptor, and the builder
     * migrates the same folder through it — two names would apply every
     * content migration twice.
     */
    it('tracks content migrations in the table the builder expects', () => {
        expect(rendered('apps/server/src/plugins.ts')).toContain(
            `table: '${builderDefault('DEFAULT_MIGRATIONS_TABLE')}'`
        );
    });
});
