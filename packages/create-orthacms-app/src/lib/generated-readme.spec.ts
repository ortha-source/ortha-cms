import {
    existsSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderTemplate, type TemplateValues } from './template';

/**
 * The generated README, checked against the app it describes.
 *
 * Nothing read this file before. `template.spec.ts` asserted that a
 * `README.md` came out of the rename, and that was the whole of it — so the
 * document drifted exactly where a document drifts: it kept naming
 * `src/server/plugins.ts` a layout change had moved to `apps/server/src/`, and
 * its `drizzle.config.ts` recipe pointed `out` two levels above the project
 * root, which a reader following it literally discovers as a folder full of
 * SQL outside their app.
 *
 * This is the first document a new user reads and the one that tells them how
 * to add a content type, which is the first thing they will want to do. So the
 * assertions here are about the two claims a README can actually be wrong
 * about in a way a machine can see:
 *
 * - **every path it names is a path this app has** — the content folders, the
 *   drizzle config and the migrations folder included, since the template now
 *   ships all of them rather than asking the reader to create them, and
 * - **every command it says to run is a command that exists** — a script in the
 *   generated manifest, resolving to a subcommand the CLI dispatches.
 *
 * Both sides are *read* rather than restated: the paths come out of the
 * rendered README and are looked for in the rendered app, and the CLI's
 * commands and layout come out of `@orthacms/cli`'s own source. A test that
 * only asserted the README contains some string would pass on a README that is
 * wrong about everything else.
 *
 * What the shipped drizzle config, the content descriptor and the schema
 * builder agree on is `generated-content.spec.ts`'s business; this file only
 * checks that the README describes the app it ships with.
 */

const TEMPLATE = join(__dirname, '../../templates/default');
const workspaceRoot = join(__dirname, '../../../..');

/** A source file of `@orthacms/cli`, read through the workspace link. */
function cliSource(path: string): string {
    return readFileSync(
        join(
            realpathSync(join(workspaceRoot, 'node_modules/@orthacms/cli')),
            path
        ),
        'utf8'
    );
}

/** A `LAYOUT` entry from the CLI — the app conventions it will not negotiate. */
function cliLayout(key: string): string {
    const source = cliSource('src/lib/project.ts');
    const match = new RegExp(`\\n    ${key}: '([^']+)'`).exec(source);

    if (!match) throw new Error(`LAYOUT has no ${key}`);

    return match[1] as string;
}

/** Every subcommand the `orthacms` binary dispatches. */
function orthacmsCommands(): string[] {
    return [...cliSource('src/cli.ts').matchAll(/\n {8}case '(\w+)':/g)].map(
        (match) => match[1] as string
    );
}

let target: string;

beforeAll(() => {
    target = mkdtempSync(join(tmpdir(), 'create-orthacms-readme-'));
    const values: TemplateValues = {
        appName: 'my-cms',
        appTitle: 'My CMS',
        databaseUrl: 'postgresql://orthacms:orthacms@localhost:5432/my_cms',
        databaseName: 'my_cms',
        adminEmail: 'admin@example.com',
        adminPassword: 'hunter2',
        orthacmsVersion: '9.9.9',
        // Every conditional block on, so the README's own `orthacms:if` sections
        // are read too rather than rendered away.
        selection: {
            enabled: new Set([
                'media-local',
                'rest',
                'graphql',
                'mcp',
                'sso-oidc'
            ])
        }
    };
    renderTemplate(TEMPLATE, target, values);
});

afterAll(() => rmSync(target, { recursive: true, force: true }));

/** The rendered README. */
function readme(): string {
    return readFileSync(join(target, 'README.md'), 'utf8');
}

/** The generated manifest's scripts. */
function scripts(): Record<string, string> {
    return (
        JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        }
    ).scripts;
}

/* --------------------------------------------------------------- the paths */

/**
 * The app-relative paths a piece of inline code names.
 *
 * A URL path (`/api/v1/mcp`), a package (`@orthacms/database`), and anything
 * with a space in it are not file paths and are left alone; a glob is trimmed
 * to the directory in front of its first `*`, since that is the part that has
 * to exist. A placeholder (`collections/<name>.ts`) is not a path either, and
 * the character class leaves it out.
 */
function pathsNamedIn(markdown: string): string[] {
    const spans = [...markdown.matchAll(/`([^`\n]+)`/g)].map(
        (match) => match[1] as string
    );

    return [
        ...new Set(
            spans
                .filter((span) =>
                    /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.*-]+)*\/?$/.test(span)
                )
                .filter((span) => span.includes('/'))
                .filter((span) => !span.startsWith('.'))
                .map((span) => span.split('*')[0] as string)
        )
    ];
}

describe('the generated README’s paths', () => {
    it('names no path this app does not have', () => {
        const missing = pathsNamedIn(readme()).filter(
            (path) => !existsSync(join(target, path))
        );

        expect(missing).toEqual([]);
    });

    /**
     * The guard on the guard. If the extraction ever stops finding paths —
     * a regex tightened, the markdown reformatted — the test above passes on
     * an empty list and the README is unread again.
     */
    it('reads the paths out of the document rather than finding none', () => {
        const paths = pathsNamedIn(readme());

        expect(paths.length).toBeGreaterThan(10);
        expect(paths).toContain('apps/server/src/plugins.ts');
    });

    /**
     * The layout the README describes is a convention `@orthacms/cli` enforces,
     * not a suggestion: `orthacms generate` refuses outright when the app has no
     * `drizzle.config.ts` at exactly this path, and `orthacms content sync`
     * rewrites the manifest in exactly this folder.
     */
    it('names the drizzle config and the content folder where the CLI looks for them', () => {
        expect(readme()).toContain(`\`${cliLayout('drizzleConfig')}\``);
        expect(readme()).toContain(`\`${cliLayout('contentDir')}/index.ts\``);
    });
});

/* ------------------------------------------------------------ the commands */

/**
 * Every `npm run <script>` / `npm <script>` the README tells you to run.
 *
 * Read out of the code — inline spans and fenced blocks — rather than out of
 * the prose, which mentions npm as a program that does things ("what stops npm
 * nesting a second copy") and would otherwise contribute `nesting` as a script
 * nobody wrote.
 */
function npmCommandsIn(markdown: string): string[] {
    const code = [
        ...[...markdown.matchAll(/`([^`\n]+)`/g)].map(
            (match) => match[1] as string
        ),
        ...[...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(
            (match) => match[1] as string
        )
    ].join('\n');

    return [
        ...new Set(
            [...code.matchAll(/\bnpm (?:run )?([a-z][a-z0-9:-]*)/g)].map(
                (match) => match[1] as string
            )
        )
    ];
}

describe('the commands the generated README tells you to run', () => {
    it('cites only scripts this app’s package.json declares', () => {
        const declared = Object.keys(scripts());
        // npm's own subcommands, which are not scripts and never will be.
        const builtin = new Set(['install', 'ci', 'exec']);

        const unknown = npmCommandsIn(readme())
            .filter((name) => !builtin.has(name))
            .filter((name) => !declared.includes(name));

        expect(unknown).toEqual([]);
    });

    it('reads the commands out of the document rather than finding none', () => {
        expect(npmCommandsIn(readme())).toEqual(
            expect.arrayContaining([
                'dev',
                'migrate',
                'generate',
                'content:sync',
                'test'
            ])
        );
    });

    /**
     * And every script that reaches for the CLI names a subcommand the CLI
     * actually dispatches — otherwise the README is right about the script and
     * the script is wrong about the binary, which is `Unknown command` in front
     * of someone on their first five minutes.
     */
    it('runs the app through subcommands the orthacms binary has', () => {
        const commands = orthacmsCommands();
        expect(commands).toContain('migrate');

        const cited = new Set(npmCommandsIn(readme()));
        const wrong = Object.entries(scripts())
            .filter(([name]) => cited.has(name))
            .map(
                ([name, script]) =>
                    [name, /^orthacms (\w+)/.exec(script)] as const
            )
            .filter(([, match]) => match !== null)
            .filter(
                ([, match]) =>
                    !commands.includes((match as RegExpExecArray)[1] as string)
            )
            .map(([name]) => name);

        expect(wrong).toEqual([]);
    });
});
