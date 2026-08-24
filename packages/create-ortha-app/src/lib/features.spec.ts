import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
    ALL_FEATURES,
    COPILOT_PROVIDERS,
    CORE_DEV_PACKAGES,
    CORE_PACKAGES,
    MEDIA_PROVIDERS,
    PROTOCOLS,
    TRANSITIVE_PACKAGES,
    resolveFlags,
    resolvePackages
} from './features';

const workspaceRoot = join(__dirname, '../../../..');

/** Every publishable `@orthacms/*` package name in the workspace. */
function publishedPackages(): string[] {
    const packagesDir = join(workspaceRoot, 'packages');
    const childDirs = (root: string): string[] =>
        readdirSync(root)
            .map((entry) => join(root, entry))
            .filter((entry) => statSync(entry).isDirectory());

    const names: string[] = [];

    for (const dir of [
        ...childDirs(packagesDir),
        ...childDirs(packagesDir).flatMap(childDirs)
    ]) {
        try {
            const manifest = JSON.parse(
                readFileSync(join(dir, 'package.json'), 'utf8')
            ) as { name?: string; private?: boolean };

            if (manifest.name?.startsWith('@orthacms/') && !manifest.private) {
                names.push(manifest.name);
            }
        } catch {
            // Not a package directory.
        }
    }

    return names;
}

/** A selection with the given feature ids enabled. */
function selectionOf(...ids: string[]) {
    return { enabled: new Set(ids) };
}

/**
 * The guard this file exists for.
 *
 * Adding a package to the workspace should force a decision about whether a
 * newly generated app gets it. Without this, the template simply falls a
 * release behind: the package publishes, nothing references it, and nobody
 * notices until a user asks why the feature they read about is missing.
 */
describe('every published package is accounted for', () => {
    const classified = new Set([
        ...CORE_PACKAGES,
        ...CORE_DEV_PACKAGES,
        ...TRANSITIVE_PACKAGES,
        ...ALL_FEATURES.flatMap((feature) => feature.packages)
    ]);

    it.each(publishedPackages())('%s is classified', (name) => {
        // If this fails you added a package. Put it in one of `CORE_PACKAGES`,
        // a `Feature`'s `packages`, or `TRANSITIVE_PACKAGES` — whichever is
        // true — in `features.ts`.
        expect([...classified]).toContain(name);
    });

    it('classifies nothing that does not exist', () => {
        const published = new Set(publishedPackages());
        const phantom = [...classified].filter(
            (name) => !published.has(name) && name !== '@orthacms/cli'
        );

        expect(phantom).toEqual([]);
    });

    it('puts no package in two groups at once', () => {
        const all = [
            ...CORE_PACKAGES,
            ...TRANSITIVE_PACKAGES,
            ...ALL_FEATURES.flatMap((feature) => feature.packages)
        ];

        expect(all.length).toBe(new Set(all).size);
    });
});

describe('feature ids', () => {
    it('are unique', () => {
        const ids = ALL_FEATURES.map((feature) => feature.id);

        expect(ids.length).toBe(new Set(ids).size);
    });

    it('include REST, so the protocol answer reads as a complete set', () => {
        expect(PROTOCOLS.map((protocol) => protocol.id)).toContain('rest');
    });
});

describe('resolvePackages', () => {
    it('installs the core set with nothing enabled', () => {
        expect(resolvePackages(selectionOf())).toEqual([...CORE_PACKAGES]);
    });

    it('adds a feature’s packages when it is enabled', () => {
        expect(resolvePackages(selectionOf('graphql'))).toContain(
            '@orthacms/content-graphql'
        );
    });

    it('leaves them out when it is not', () => {
        expect(resolvePackages(selectionOf())).not.toContain(
            '@orthacms/content-graphql'
        );
    });

    /**
     * The copilot ships with every app. Its server half arrives anyway — five
     * core plugins depend on `copilot-server` to contribute their tools — so
     * leaving it undeclared bought nothing but a missing chat panel, and the
     * `fake` adapter needs no key and no network.
     */
    it('installs the copilot with nothing enabled', () => {
        const packages = resolvePackages(selectionOf());

        expect(packages).toEqual(
            expect.arrayContaining([
                '@orthacms/copilot-server',
                '@orthacms/copilot-admin',
                '@orthacms/copilot-provider-fake'
            ])
        );
    });

    it('adds a model backend only when its provider is chosen', () => {
        expect(resolvePackages(selectionOf())).not.toContain(
            '@orthacms/copilot-provider-anthropic'
        );
        expect(resolvePackages(selectionOf('copilot-anthropic'))).toContain(
            '@orthacms/copilot-provider-anthropic'
        );
    });

    /**
     * These all arrive transitively, so an import resolves on npm's flat
     * `node_modules` whether or not they are declared. Declaring them is what
     * makes that resolution the app's own: an undeclared import breaks the
     * moment a version conflict nests a copy, and never resolves under pnpm.
     */
    it.each([
        '@orthacms/content-domain',
        '@orthacms/copilot-domain',
        '@orthacms/tools-server',
        '@orthacms/query-builder-admin'
    ])('declares %s, rather than relying on hoisting', (name) => {
        expect(resolvePackages(selectionOf())).toContain(name);
    });

    /**
     * The remaining opt-ins, in full. Anything else a published package could
     * be, a default app already has — so this list is also the answer to "what
     * does choosing nothing cost me?".
     */
    it('leaves exactly the choosable packages out of a default app', () => {
        const published = new Set(publishedPackages());
        const installed = new Set(resolvePackages(selectionOf('media-local')));
        const missing = [...published].filter(
            (name) =>
                !installed.has(name) &&
                name !== '@orthacms/cli' &&
                // Published, and deliberately never installed into an app —
                // tools for writing a storage provider, not for running one.
                !TRANSITIVE_PACKAGES.includes(name)
        );

        expect(missing.sort()).toEqual([
            '@orthacms/content-graphql',
            '@orthacms/copilot-provider-anthropic',
            '@orthacms/copilot-provider-openai',
            '@orthacms/mcp-server',
            '@orthacms/media-provider-s3'
        ]);
    });

    it('does not install the S3 adapter unless it is chosen', () => {
        expect(resolvePackages(selectionOf('media-local'))).not.toContain(
            '@orthacms/media-provider-s3'
        );
    });

    it('adds nothing for REST, which needs no package of its own', () => {
        expect(resolvePackages(selectionOf('rest'))).toEqual([
            ...CORE_PACKAGES
        ]);
    });

    it('returns a sorted list with no duplicates', () => {
        const packages = resolvePackages(
            selectionOf('media-local', 'copilot-anthropic', 'copilot-openai')
        );

        expect(packages).toEqual([...packages].sort());
        expect(packages.length).toBe(new Set(packages).size);
    });
});

describe('resolveFlags', () => {
    it('is the picked ids, with nothing derived', () => {
        expect(resolveFlags(selectionOf('mcp', 'copilot-openai'))).toEqual(
            new Set(['mcp', 'copilot-openai'])
        );
    });
});

describe('availability', () => {
    it('offers the S3 adapter, now that it is implemented', () => {
        // It was listed and disabled while `provider-s3` threw from every
        // method: offering it then would have generated an app that boots and
        // fails on the first upload.
        const s3 = MEDIA_PROVIDERS.find(
            (provider) => provider.id === 'media-s3'
        );

        expect(s3?.available).toBe(true);
    });

    it('leaves exactly one storage adapter selectable by default', () => {
        const defaults = MEDIA_PROVIDERS.filter(
            (provider) => provider.enabledByDefault && provider.available
        );

        expect(defaults).toHaveLength(1);
    });

    /**
     * Both are off by default deliberately: an endpoint nobody asked for is
     * still an endpoint, and a copilot provider sends content to a third party.
     */
    it('starts every opt-in feature switched off', () => {
        const optIn = [
            ...COPILOT_PROVIDERS,
            ...PROTOCOLS.filter((protocol) => !protocol.locked)
        ];

        for (const feature of optIn) {
            expect(feature.enabledByDefault).toBe(false);
        }
    });

    it('locks REST on, so it cannot be switched off', () => {
        const rest = PROTOCOLS.find((protocol) => protocol.id === 'rest');

        expect(rest?.locked).toBe(true);
        expect(rest?.enabledByDefault).toBe(true);
    });
});
