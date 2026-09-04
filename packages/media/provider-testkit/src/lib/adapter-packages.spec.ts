import { builtinModules } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The structural half of the adapter contract, asserted across every
 * `packages/media/provider-*` at once — the behavioural half is
 * `describeStorageProvider`, which each adapter runs against a real backend.
 *
 * The rule the split exists for: an application picks **one** backend and must
 * not pay for the other five, so an adapter carries its own vendor SDK and
 * nothing else. A NestJS import inside one — a `@Injectable()` reached for
 * while wiring a client, a `ConfigService` to read a bucket name — would make
 * the framework a dependency of every deployment that chose that backend, and
 * would compile and pass its whole suite on the way in.
 *
 * The check is "every non-relative import is either a node built-in or a
 * package this manifest declares", rather than a denylist of the four names we
 * happen to worry about today. A denylist only bans what someone thought of;
 * this one makes the manifest the statement of what an adapter costs, and the
 * manifests are then checked for the framework directly.
 *
 * **What this does not establish** is the invariant's parenthesis, "the port's
 * type, erased at compile time". It is not: every adapter imports
 * `ObjectNotFoundError` as a *value* from `@orthacms/media-server`, whose root
 * barrel re-exports `MediaModule` — so loading an adapter loads the Nest module
 * (traced: `provider-local/src/index.ts` → `@orthacms/media-server` →
 * `lib/utils/media-plugin` → `../media.module`), and `@orthacms/media-server`
 * is a runtime `dependency` of all six. Recorded as `partial` in the coverage
 * ledger; what holds, and is pinned here, is that no adapter reaches for the
 * framework itself.
 */
describe('the storage adapter packages', () => {
    /** `packages/media` — this package's own grandparent. */
    const GROUP = join(__dirname, '../../..');

    type Adapter = {
        name: string;
        manifest: { name: string } & Record<string, Record<string, string>>;
        /** Absolute paths of every `.ts` file under `src/`. */
        sources: string[];
    };

    const sourcesOf = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) return sourcesOf(path);
            return entry.name.endsWith('.ts') ? [path] : [];
        });

    const ADAPTERS: Adapter[] = readdirSync(GROUP)
        .filter(
            (name) =>
                name.startsWith('provider-') &&
                statSync(join(GROUP, name)).isDirectory()
        )
        .sort()
        .map((name) => ({
            name,
            manifest: JSON.parse(
                readFileSync(join(GROUP, name, 'package.json'), 'utf8')
            ),
            sources: sourcesOf(join(GROUP, name, 'src'))
        }));

    /** Every module specifier a file imports or re-exports from. */
    const specifiersOf = (path: string): string[] =>
        [...readFileSync(path, 'utf8').matchAll(/from\s+'([^']+)'/g)].map(
            (match) => match[1]
        );

    /** The first path segment of a bare specifier: its package name. */
    const packageOf = (specifier: string): string => {
        const parts = specifier.split('/');
        return specifier.startsWith('@')
            ? parts.slice(0, 2).join('/')
            : parts[0];
    };

    const BUILTIN = new Set(builtinModules);
    const isBuiltin = (specifier: string) =>
        BUILTIN.has(specifier.replace(/^node:/, '').split('/')[0]);

    /** What no adapter may reach for, however it is declared. */
    const FORBIDDEN = (name: string) =>
        name.startsWith('@nestjs/') ||
        name === 'react' ||
        name === 'react-dom' ||
        name === 'drizzle-orm' ||
        name === 'class-validator' ||
        name === 'express' ||
        name === '@orthacms/database';

    it('found every adapter package', () => {
        // A wrong path, or a rename, would leave `it.each` iterating an empty
        // list — every case below would pass having read nothing.
        expect(ADAPTERS.map((one) => one.name)).toEqual([
            'provider-azure',
            'provider-gcs',
            'provider-local',
            'provider-memory',
            'provider-s3',
            'provider-testkit',
            'provider-vercel-blob'
        ]);
        for (const adapter of ADAPTERS) {
            expect(adapter.sources.length).toBeGreaterThan(0);
        }
    });

    // covers: media:I-34
    it.each(ADAPTERS.map((a) => [a.name, a] as const))(
        '%s declares no framework',
        (_name, adapter) => {
            const declared = [
                ...Object.keys(adapter.manifest.dependencies ?? {}),
                ...Object.keys(adapter.manifest.devDependencies ?? {}),
                ...Object.keys(adapter.manifest.peerDependencies ?? {})
            ];

            expect(declared.filter(FORBIDDEN)).toEqual([]);
        }
    );

    // covers: media:I-34
    it.each(ADAPTERS.map((a) => [a.name, a] as const))(
        '%s imports nothing it does not declare',
        (_name, adapter) => {
            const declared = new Set([
                ...Object.keys(adapter.manifest.dependencies ?? {}),
                ...Object.keys(adapter.manifest.devDependencies ?? {}),
                ...Object.keys(adapter.manifest.peerDependencies ?? {})
            ]);

            const undeclared = adapter.sources.flatMap((path) =>
                specifiersOf(path)
                    .filter((spec) => !spec.startsWith('.'))
                    .filter((spec) => !isBuiltin(spec))
                    .filter((spec) => !declared.has(packageOf(spec)))
                    .map((spec) => `${path.split('/src/')[1]}: ${spec}`)
            );

            expect(undeclared).toEqual([]);
        }
    );

    // covers: media:I-34
    it.each(ADAPTERS.map((a) => [a.name, a] as const))(
        '%s reaches for one Ortha package — the port, and nothing else',
        (_name, adapter) => {
            // The testkit is the exception the manifests already record: an
            // adapter keeps it in `devDependencies` to run the shared contract
            // suite, so it never travels with the shipped package.
            const ortha = adapter.sources.flatMap((path) =>
                specifiersOf(path)
                    .map(packageOf)
                    .filter((name) => name.startsWith('@orthacms/'))
                    .filter(
                        (name) => name !== '@orthacms/media-provider-testkit'
                    )
            );

            expect([...new Set(ortha)]).toEqual(['@orthacms/media-server']);
        }
    );
});
