import {
    readFileSync,
    readdirSync,
    mkdtempSync,
    realpathSync,
    rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderTemplate, type TemplateValues } from './template';

/**
 * What the generated app is composed of — asserted from the template, before
 * anyone has scaffolded anything.
 *
 * The generated app ships specs of its own that assert exactly this
 * (`apps/{server,admin}/src/plugins.spec.ts`), and **they never run here**: the
 * scaffolder's `testMatch` is `src/**` and the template is data. So the one
 * thing those specs cannot check is whether *they themselves* still describe
 * the app — and that is the failure this file exists for. A plugin added to
 * `plugins.ts` and not to `EXPECTED_PLUGINS` makes `npm test` red in every app
 * generated from that day on, in the first minute of a new user's first
 * project, and nothing upstream notices.
 *
 * Both sides are read rather than re-stated. The registered list comes from the
 * rendered `plugins.ts`; each plugin's *name* comes from the package that
 * defines the factory — so this cannot drift into agreeing with a template that
 * is wrong. What it cannot see is a factory that decides its own name from its
 * arguments; none of them does.
 */

const TEMPLATE = join(__dirname, '../../templates/default');
const workspaceRoot = join(__dirname, '../../../..');

/** Base values, with the given feature ids enabled. */
function valuesWith(...ids: string[]): TemplateValues {
    return {
        appName: 'my-cms',
        appTitle: 'My CMS',
        databaseUrl: 'postgresql://ortha:ortha@localhost:5432/my_cms',
        databaseName: 'my_cms',
        adminEmail: 'admin@example.com',
        adminPassword: 'hunter2',
        orthaVersion: '9.9.9',
        selection: { enabled: new Set(ids) }
    };
}

let target: string;

beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'create-ortha-'));
});

afterEach(() => rmSync(target, { recursive: true, force: true }));

/** Scaffolds with the given features enabled and reads a file back. */
function scaffold(...ids: string[]): (path: string) => string {
    renderTemplate(TEMPLATE, target, valuesWith(...ids));
    return (path: string) => readFileSync(join(target, path), 'utf8');
}

/* ------------------------------------------------------- reading the template */

/** The body of `buildPlugins`'s returned array. */
function pluginArray(source: string): string {
    const start = source.indexOf('export function buildPlugins');
    const open = source.indexOf('return [', start);
    const close = source.indexOf('\n    ];', open);

    expect(start).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);

    return source.slice(open, close);
}

/**
 * The factories registered in `buildPlugins`, in order.
 *
 * Entries sit at exactly one indent level inside the array, so a nested option
 * (`provider:`, `config:`) and a closing `}),` are both skipped. A bare
 * identifier — `content,`, held in a variable because the GraphQL adapter takes
 * the plugin itself — is resolved back to the factory that built it.
 */
function registeredFactories(source: string): string[] {
    const aliases = new Map<string, string>();
    for (const [, alias, factory] of source.matchAll(
        /const\s+(\w+)\s*=\s*(\w+Plugin)\(/g
    )) {
        aliases.set(alias as string, factory as string);
    }

    const names: string[] = [];
    for (const line of pluginArray(source).split('\n')) {
        const match = /^ {8}([A-Za-z_$][\w$]*)\s*[(,]/.exec(line);
        if (!match) continue;
        const token = match[1] as string;
        names.push(aliases.get(token) ?? token);
    }

    return names;
}

/** Which `@orthacms/*` package each imported factory came from. */
function importedFrom(source: string): Map<string, string> {
    const owners = new Map<string, string>();
    for (const [, specifiers, pkg] of source.matchAll(
        /^import\s+\{([\s\S]*?)\}\s+from\s+'(@orthacms\/[^']+)'/gm
    )) {
        for (const specifier of (specifiers as string).split(',')) {
            const name = specifier.trim();
            if (!name || name.startsWith('type ')) continue;
            owners.set(name, pkg as string);
        }
    }
    return owners;
}

/** Every source file of a workspace package. */
function sourcesOf(pkg: string): string[] {
    const root = join(
        realpathSync(join(workspaceRoot, 'node_modules', pkg)),
        'src'
    );
    const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
            entry.isDirectory()
                ? walk(join(dir, entry.name))
                : /\.tsx?$/.test(entry.name)
                  ? [join(dir, entry.name)]
                  : []
        );
    return walk(root);
}

/**
 * The `name` a plugin factory gives itself, read from the package that defines
 * it — the same string the generated app's spec compares against at runtime.
 */
function pluginNameOf(factory: string, pkg: string): string {
    for (const file of sourcesOf(pkg)) {
        const source = readFileSync(file, 'utf8');
        const at = source.indexOf(`export function ${factory}(`);
        if (at === -1) continue;
        const match = /\n\s+name: '([^']+)'/.exec(source.slice(at));
        if (match) return match[1] as string;
    }
    throw new Error(`${factory} is not defined in ${pkg}`);
}

/** The plugin names a rendered `plugins.ts` registers, in order. */
function registeredNames(source: string): string[] {
    const owners = importedFrom(source);
    return registeredFactories(source).map((factory) => {
        const pkg = owners.get(factory);
        if (!pkg) throw new Error(`${factory} is imported from nowhere`);
        return pluginNameOf(factory, pkg);
    });
}

/** The list a rendered `plugins.spec.ts` expects. */
function expectedNames(source: string): string[] {
    const open = source.indexOf('const EXPECTED_PLUGINS = [');
    const close = source.indexOf('\n];', open);

    expect(open).toBeGreaterThan(-1);

    return (
        source
            .slice(open, close)
            .split('\n')
            .filter((line) => !line.trim().startsWith('//'))
            .join('\n')
            .match(/'([a-z0-9-]+)'/g) ?? []
    ).map((quoted) => quoted.slice(1, -1));
}

/* ------------------------------------------------------------------- the tests */

/**
 * Every combination the two conditional plugins produce. The generated app's
 * expected list carries `ortha:if` blocks of its own, so it has to stay right
 * for each of them rather than for the one the author happened to render.
 */
const COMBINATIONS: readonly (readonly string[])[] = [
    [],
    ['graphql'],
    ['mcp'],
    ['graphql', 'mcp']
];

describe('the generated app’s server composition', () => {
    it.each(
        COMBINATIONS.map(
            (ids) => [ids.join(', ') || 'nothing optional', ids] as const
        )
    )(
        'ships a plugins.spec.ts that expects what plugins.ts registers — %s [create-ortha-app:I-29]',
        (_label, ids) => {
            const rendered = scaffold('media-local', 'rest', ...ids);

            expect(
                expectedNames(rendered('apps/server/src/plugins.spec.ts'))
            ).toEqual(registeredNames(rendered('apps/server/src/plugins.ts')));
        }
    );

    /**
     * The order is migration order: migrations are applied by walking this
     * array with no transaction spanning plugins, so a plugin whose tables
     * reference another's must come after it. `workspaces.memberships`
     * FK-references identity's `users` — reversed, a *fresh* migrate fails
     * while an already-migrated database is perfectly happy, so the mistake
     * ships and bites the next clean install rather than its author.
     */
    it('opens the database first and migrates identity before workspaces [create-ortha-app:I-27]', () => {
        const names = registeredNames(
            scaffold('media-local', 'rest')('apps/server/src/plugins.ts')
        );

        expect(names[0]).toBe('database');
        expect(names.indexOf('identity')).toBeLessThan(
            names.indexOf('workspaces')
        );
    });

    /** It serves whatever the plugins above it contributed, so it comes last. */
    it('registers MCP last, where present [create-ortha-app:I-27]', () => {
        const withMcp = registeredNames(
            scaffold(
                'media-local',
                'rest',
                'graphql',
                'mcp'
            )('apps/server/src/plugins.ts')
        );

        expect(withMcp.at(-1)).toBe('mcp');
        expect(withMcp).toContain('content-graphql');
    });
});

describe('the generated app’s admin composition', () => {
    it('ships a plugins.spec.ts that expects what plugins.ts registers [create-ortha-app:I-29]', () => {
        const rendered = scaffold('media-local', 'rest');

        expect(
            expectedNames(rendered('apps/admin/src/plugins.spec.ts'))
        ).toEqual(registeredNames(rendered('apps/admin/src/plugins.ts')));
    });

    /**
     * The host mounts the **first** layout it finds, and the shell's is what
     * composes identity's auth gate — so a second contributor placed ahead of
     * it renders every private route *ungated*, which looks like a styling
     * accident rather than an authorization hole. Identity is first for the
     * opposite reason: sign-in and accept-invite must render outside that gate.
     *
     * The "exactly one" half is read from the packages themselves, not from the
     * template: a plugin that grows a `layout` in some later release fails here
     * without anyone having touched the scaffolder.
     */
    it('lets only the shell supply a layout, and puts identity first [create-ortha-app:I-28]', () => {
        const source = scaffold(
            'media-local',
            'rest'
        )('apps/admin/src/plugins.ts');
        const owners = importedFrom(source);
        const factories = registeredFactories(source);

        const layouts = factories.filter((factory) =>
            sourcesOf(owners.get(factory) as string).some((file) => {
                const text = readFileSync(file, 'utf8');
                const at = text.indexOf(`export function ${factory}(`);
                return at !== -1 && /\n[ \t]+layout:/.test(text.slice(at));
            })
        );

        expect(layouts).toEqual(['ShellPlugin']);
        expect(registeredNames(source)[0]).toBe('identity');
    });
});
