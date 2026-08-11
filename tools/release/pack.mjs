/**
 * Stages one workspace package for `npm publish`.
 *
 * In the workspace every package resolves **from source** — `exports` points
 * at `./src/index.ts` and `tsconfig.base.json` sets the
 * `@ortha-cms/source` condition (see AGENTS.md, "How packages resolve").
 * That is a workspace concern, and a published tarball cannot rely on it: a
 * consumer has no such condition and no way to compile our TypeScript.
 *
 * So nothing about the checked-in manifests changes. Instead `pack` builds a
 * throwaway package root under `dist/pack/<projectRoot>/` that holds what
 * the registry should see:
 *
 *     package.json     rewritten — exports point at ./dist, workspace
 *                      dependencies pinned to the released version
 *     dist/            the tsc output (JS + .d.ts), plus any non-TS asset
 *                      that lived beside the source (e.g. styles.css)
 *     migrations/      verbatim, for plugins that ship Drizzle migrations
 *     README.md LICENSE
 *
 * `nx release publish` points its `packageRoot` here (the target is inferred
 * by `@ortha-cms/nx`), so the tarball is exactly this directory.
 *
 * It has to live at the workspace root rather than beside the package: the
 * root `workspaces` globs cover `packages/*`, so a staging directory inside
 * a flat package is itself read as a workspace, and npm refuses to run at
 * all against two workspaces with the same name.
 *
 * Usage: node tools/release/pack.mjs <projectRoot>
 */

import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative } from 'node:path';
import ts from 'typescript';

const workspaceRoot = process.cwd();
const projectRoot = process.argv[2];

if (!projectRoot) {
    fail('usage: node tools/release/pack.mjs <projectRoot>');
}

const projectDir = join(workspaceRoot, projectRoot);
const manifestPath = join(projectDir, 'package.json');

if (!existsSync(manifestPath)) {
    fail(`no package.json at ${projectRoot}`);
}

const pkg = readJson(manifestPath);
const rootPkg = readJson(join(workspaceRoot, 'package.json'));
const stagingDir = join(workspaceRoot, 'dist', 'pack', projectRoot);
const buildDir = join(projectDir, 'dist');

const repoUrl =
    rootPkg.repository?.url ??
    'git+https://github.com/ortha-source/ortha-cms.git';
const homepage = repoUrl.replace(/^git\+/, '').replace(/\.git$/, '');

if (!existsSync(buildDir)) {
    fail(`${pkg.name} has no dist/ — run \`nx build ${pkg.name}\` first`);
}

/* ------------------------------------------------------------------ files */

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

// The compiler output. `.tsbuildinfo` is incremental-build state, not a file
// consumers have any use for.
cpSync(buildDir, join(stagingDir, 'dist'), {
    recursive: true,
    filter: (src) => !src.endsWith('.tsbuildinfo')
});

// tsc only emits what it compiles, so anything non-TS that sits beside the
// source (`src/styles.css`) has to be carried over by hand, at the same
// relative path the compiled files landed on.
for (const asset of assetsIn(join(projectDir, 'src'))) {
    const target = join(
        stagingDir,
        'dist',
        relative(join(projectDir, 'src'), asset)
    );
    mkdirSync(join(target, '..'), { recursive: true });
    cpSync(asset, target);
}

// Migrations are resolved at runtime as `join(__dirname, '../../../migrations')`
// from `<pkg>/dist/lib/utils/`, which is the same depth the source used — so
// they only need to keep sitting at the package root.
const migrations = join(projectDir, 'migrations');
if (existsSync(migrations)) {
    cpSync(migrations, join(stagingDir, 'migrations'), { recursive: true });
}

cpSync(join(workspaceRoot, 'LICENSE'), join(stagingDir, 'LICENSE'));

const readme = join(projectDir, 'README.md');
if (existsSync(readme)) {
    cpSync(readme, join(stagingDir, 'README.md'));
} else {
    writeFileSync(join(stagingDir, 'README.md'), stubReadme(pkg.name));
}

/* --------------------------------------------------------------- manifest */

const staged = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? `${pkg.name} — part of Ortha CMS.`,
    license: pkg.license ?? rootPkg.license,
    homepage: `${homepage}/tree/main/${projectRoot}`,
    repository: { type: 'git', url: repoUrl, directory: projectRoot },
    bugs: { url: `${homepage}/issues` },
    main: toBuilt(pkg.main),
    types: toTypes(pkg.types),
    exports: remapExports(pkg.exports),
    files: ['dist', ...(existsSync(migrations) ? ['migrations'] : [])],
    dependencies: resolveDependencies(pkg.dependencies),
    ...(pkg.peerDependencies ? { peerDependencies: pkg.peerDependencies } : {}),
    ...(pkg.peerDependenciesMeta
        ? { peerDependenciesMeta: pkg.peerDependenciesMeta }
        : {}),
    // Scoped packages publish as restricted by default, which fails for an
    // account without a paid org. Say what we mean instead.
    publishConfig: { access: 'public' }
};

writeFileSync(
    join(stagingDir, 'package.json'),
    `${JSON.stringify(staged, null, 4)}\n`
);

verifyEntryPoints(staged);
verifyDependenciesAreDeclared(staged);

console.log(
    `packed ${pkg.name}@${pkg.version} → ${relative(workspaceRoot, stagingDir)}`
);

/* ---------------------------------------------------------------- helpers */

/**
 * `./src/index.ts` → `./dist/index.js`. Non-TS paths (a stylesheet) keep
 * their extension; anything already outside `src/` (`./package.json`) is
 * left alone.
 */
function toBuilt(path) {
    if (typeof path !== 'string' || !path.startsWith('./src/')) return path;
    return path.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.js');
}

function toTypes(path) {
    if (typeof path !== 'string' || !path.startsWith('./src/')) return path;
    return path.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.d.ts');
}

/**
 * Every subpath in the workspace manifest points at TypeScript source. The
 * published one offers the declarations first (so `types` wins for tsc) and
 * the compiled JS as the default.
 */
function remapExports(exports) {
    if (!exports) return undefined;

    const remapped = {};

    for (const [subpath, value] of Object.entries(exports)) {
        if (typeof value === 'string') {
            remapped[subpath] = /\.tsx?$/.test(value)
                ? { types: toTypes(value), default: toBuilt(value) }
                : toBuilt(value);
            continue;
        }

        // A conditions object — in this workspace every branch names the same
        // source file, so any of them identifies the entry point.
        const source = value.types ?? value.import ?? value.default;
        if (!source)
            fail(`export "${subpath}" of ${pkg.name} has no resolvable entry`);

        remapped[subpath] = {
            types: toTypes(source),
            default: toBuilt(source)
        };
    }

    return remapped;
}

/**
 * Workspace dependencies are declared as `"*"`, which on the registry means
 * "whatever is latest" — never what the package was built against. Pin each
 * to the version its own manifest carries at release time.
 */
function resolveDependencies(dependencies) {
    const resolved = {};

    for (const [name, range] of Object.entries(dependencies ?? {})) {
        if (range !== '*') {
            resolved[name] = range;
            continue;
        }

        const dep = workspaceManifest(name);
        if (!dep)
            fail(
                `${pkg.name} depends on ${name} at "*", but it is not a workspace package`
            );
        if (dep.private)
            fail(
                `${pkg.name} depends on ${name}, which is private and will never be published`
            );

        resolved[name] = `^${dep.version}`;
    }

    // `importHelpers` is on workspace-wide, so the emitted JS reaches for
    // tslib at runtime whether or not the source ever mentions it.
    resolved.tslib ??= rootPkg.devDependencies.tslib ?? '^2.3.0';

    return sortKeys(resolved);
}

/**
 * Packages are flat (`packages/<name>`) or grouped
 * (`packages/<group>/<name>`), which is the two levels the root `workspaces`
 * globs cover — but the search is depth-agnostic on purpose, so that a
 * dependency is never reported as "not a workspace package" merely because
 * someone nested it one level further than the convention.
 */
function workspaceManifest(name) {
    for (const file of manifestsUnder(join(workspaceRoot, 'packages'))) {
        const manifest = readJson(file);
        if (manifest.name === name) return manifest;
    }

    return undefined;
}

function manifestsUnder(dir) {
    if (!existsSync(dir)) return [];

    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);

        // A package's own build output holds a copy of its manifest; walking
        // into it would match a stale name.
        if (entry.isDirectory()) {
            return ['node_modules', 'dist'].includes(entry.name)
                ? []
                : manifestsUnder(path);
        }

        return entry.name === 'package.json' ? [path] : [];
    });
}

function assetsIn(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return assetsIn(path);
        return /\.(ts|tsx)$/.test(entry.name) ? [] : [path];
    });
}

/**
 * A tarball whose `exports` name a file the build never emitted installs
 * fine and explodes on the consumer's first import. Catch it here, while the
 * only cost is a failed release.
 */
function verifyEntryPoints(manifest) {
    const paths = new Set([manifest.main, manifest.types]);

    for (const value of Object.values(manifest.exports ?? {})) {
        if (typeof value === 'string') paths.add(value);
        else Object.values(value).forEach((path) => paths.add(path));
    }

    const missing = [...paths]
        .filter((path) => typeof path === 'string' && path !== './package.json')
        .filter((path) => !existsSync(join(stagingDir, path)));

    if (missing.length) {
        fail(
            `${manifest.name} declares entry points that were not built: ${missing.join(', ')}`
        );
    }
}

/**
 * Catches the phantom dependency — a package importing something only the
 * *workspace root* depends on. npm hoists it into the shared `node_modules`,
 * so it resolves in development and in the apps, and is simply absent from
 * the consumer's tree once the package is installed from the registry.
 *
 * Type-only imports count: they end up in the emitted `.d.ts`, and a
 * consumer that cannot resolve them gets the errors instead of us.
 */
function verifyDependenciesAreDeclared(manifest) {
    const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        manifest.name
    ]);

    const undeclared = new Map();

    for (const file of sourceFiles(join(projectDir, 'src'))) {
        const { importedFiles } = ts.preProcessFile(
            readFileSync(file, 'utf8'),
            true,
            true
        );

        for (const { fileName: specifier } of importedFiles) {
            if (specifier.startsWith('.') || specifier.startsWith('/'))
                continue;

            // `@scope/name/subpath` and `name/subpath` both belong to the
            // package named by their first segment (or first two, if scoped).
            const segments = specifier.split('/');
            const name = specifier.startsWith('@')
                ? segments.slice(0, 2).join('/')
                : segments[0];

            if (declared.has(name)) continue;
            if (name.startsWith('node:') || builtinModules.includes(name))
                continue;

            if (!undeclared.has(name))
                undeclared.set(name, relative(projectDir, file));
        }
    }

    if (undeclared.size) {
        const detail = [...undeclared].map(
            ([name, file]) => `  ${name} (imported by ${file})`
        );
        fail(
            `${manifest.name} imports packages it does not declare:\n${detail.join('\n')}`
        );
    }
}

/** Everything the library build compiles — so, no specs. */
function sourceFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        if (!/\.tsx?$/.test(entry.name)) return [];
        return /\.(spec|test)\./.test(entry.name) ? [] : [path];
    });
}

function sortKeys(record) {
    return Object.fromEntries(
        Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
    );
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function stubReadme(name) {
    return [
        `# ${name}`,
        '',
        `Part of [Ortha CMS](${homepage}).`,
        '',
        '```sh',
        `npm install ${name}`,
        '```',
        ''
    ].join('\n');
}

function fail(message) {
    console.error(`pack: ${message}`);
    process.exit(1);
}
