import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COPILOT_PROVIDERS, type FeatureSelection } from './features';
import { generateSecret, render, renderTemplate } from './template';
import type { TemplateValues } from './template';

const TEMPLATE = join(__dirname, '../../templates/default');

/** Base values, with the given feature ids enabled. */
function valuesWith(...ids: string[]): TemplateValues {
    const selection: FeatureSelection = { enabled: new Set(ids) };
    return {
        appName: 'my-cms',
        appTitle: 'My CMS',
        databaseUrl: 'postgresql://ortha:ortha@localhost:5432/my_cms',
        databaseName: 'my_cms',
        adminEmail: 'admin@example.com',
        adminPassword: 'hunter2',
        orthaVersion: '9.9.9',
        selection
    };
}

let target: string;

beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'create-ortha-'));
});

afterEach(() => rmSync(target, { recursive: true, force: true }));

/** Scaffolds with the given features enabled. */
function scaffold(...ids: string[]): void {
    renderTemplate(TEMPLATE, target, valuesWith(...ids));
}

/** Reads a rendered file out of the scaffolded app. */
function rendered(path: string): string {
    return readFileSync(join(target, path), 'utf8');
}

/** The generated manifest. */
function manifest(): {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
} {
    return JSON.parse(rendered('package.json'));
}

describe('render', () => {
    it('substitutes every occurrence of a placeholder, not just the first', () => {
        expect(render('__APP_NAME__/__APP_NAME__', valuesWith())).toBe(
            'my-cms/my-cms'
        );
    });

    it('gives each secret placeholder an independent value', () => {
        const [session, token] = render(
            '__SESSION_SECRET__ __TOKEN_SECRET__',
            valuesWith()
        ).split(' ');

        expect(session).not.toBe(token);
    });
});

describe('generateSecret', () => {
    it('is URL-safe, so it survives a .env round trip unquoted', () => {
        expect(generateSecret()).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('carries 256 bits of entropy', () => {
        expect(generateSecret()).toHaveLength(43);
    });

    it('does not repeat', () => {
        const secrets = new Set(
            Array.from({ length: 50 }, () => generateSecret())
        );

        expect(secrets.size).toBe(50);
    });
});

describe('the scaffolded app, whatever the features', () => {
    beforeEach(() => scaffold('media-local', 'rest'));

    it('pins every @orthacms dependency to this scaffolder’s version', () => {
        const { dependencies, devDependencies } = manifest();
        const ortha = Object.entries({
            ...dependencies,
            ...devDependencies
        }).filter(([name]) => name.startsWith('@orthacms/'));

        expect(ortha.length).toBeGreaterThan(0);
        for (const [, range] of ortha) expect(range).toBe('9.9.9');
    });

    /**
     * Releases are lockstep, and a partial upgrade can leave two copies of a
     * shared package in `node_modules` — two React context instances, and a UI
     * that silently stops talking to itself. Exact pins make an upgrade
     * all-or-nothing.
     */
    it('pins them exactly, with no caret', () => {
        for (const [name, range] of Object.entries(manifest().dependencies)) {
            if (!name.startsWith('@orthacms/')) continue;
            expect(range.startsWith('^')).toBe(false);
        }
    });

    it('keeps the non-Ortha dependencies the template declares', () => {
        expect(manifest().dependencies).toHaveProperty('react');
        expect(manifest().devDependencies).toHaveProperty('vite');
    });

    it('sorts the dependency map', () => {
        const names = Object.keys(manifest().dependencies);

        expect(names).toEqual([...names].sort());
    });

    /**
     * npm silently refuses to publish a file named `.gitignore`, so the
     * template stores it as `_gitignore`. If this rename ever breaks, every
     * generated app starts by offering to commit `node_modules` — and nothing
     * about the tarball looks wrong.
     */
    it('restores the dotfiles npm will not publish', () => {
        expect(readdirSync(target)).toContain('.gitignore');
        expect(readdirSync(target)).not.toContain('_gitignore');
        expect(rendered('.gitignore')).toContain('node_modules');
    });

    it('renames the .tmpl files onto their real names', () => {
        const entries = readdirSync(target);

        expect(entries).toEqual(
            expect.arrayContaining(['package.json', '.env', 'README.md'])
        );
        expect(entries.filter((entry) => entry.endsWith('.tmpl'))).toEqual([]);
    });

    it('fills the secrets rather than leaving them blank', () => {
        expect(rendered('.env')).toMatch(/SESSION_SECRET=[A-Za-z0-9_-]{43}/);
        expect(rendered('.env')).toMatch(/TOKEN_SECRET=[A-Za-z0-9_-]{43}/);
    });

    it('leaves no placeholder or directive in any rendered file', () => {
        for (const file of [
            'package.json',
            '.env',
            'README.md',
            'index.html',
            'docker-compose.yml',
            'src/server/ortha.config.ts',
            'src/server/plugins.ts',
            'src/admin/plugins.ts',
            'src/admin/styles.css'
        ]) {
            expect(rendered(file)).not.toMatch(/__[A-Z_]+__/);
            expect(rendered(file)).not.toMatch(/ortha:(if|ifnot|end)/);
        }
    });

    /**
     * Tailwind excludes `node_modules` from content detection, so without this
     * line the admin renders completely unstyled — and nothing errors.
     */
    it('points Tailwind at the installed packages', () => {
        expect(rendered('src/admin/styles.css')).toContain(
            '@source "../../node_modules/@orthacms/*/dist/**/*.js"'
        );
    });
});

describe('with nothing optional chosen', () => {
    beforeEach(() => scaffold('media-local', 'rest'));

    /**
     * The copilot ships with every app: its server half arrives transitively
     * whatever the manifest says, and the bundled `fake` adapter needs no key
     * and no network — so a default app has a chat that works offline.
     */
    it('installs and registers the copilot', () => {
        const names = Object.keys(manifest().dependencies);

        expect(names).toEqual(
            expect.arrayContaining([
                '@orthacms/copilot-server',
                '@orthacms/copilot-admin',
                '@orthacms/copilot-provider-fake'
            ])
        );
        expect(rendered('src/server/plugins.ts')).toContain('CopilotPlugin(');
        expect(rendered('src/admin/plugins.ts')).toContain('CopilotPlugin()');
    });

    it('leaves it switched off until an operator opts in', () => {
        expect(rendered('.env')).toContain('COPILOT_ENABLED=false');
    });

    it('installs no model backend beyond the offline one', () => {
        const names = Object.keys(manifest().dependencies);

        expect(names).not.toContain('@orthacms/copilot-provider-anthropic');
        expect(names).not.toContain('@orthacms/copilot-provider-openai');
        expect(rendered('.env')).not.toContain('ANTHROPIC_API_KEY');
    });

    it('registers only the offline provider', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).toContain('createFakeProvider');
        expect(plugins).not.toContain('createAnthropicProvider');
        expect(plugins).not.toContain('createOpenAiProvider');
    });

    it('mounts neither GraphQL nor MCP', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).not.toContain('ContentGraphqlPlugin');
        expect(plugins).not.toContain('McpPlugin');
    });

    it('still registers the core plugins', () => {
        const plugins = rendered('src/server/plugins.ts');

        for (const name of [
            'DatabasePlugin',
            'IdentityPlugin',
            'WorkspacesPlugin',
            'ContentPlugin',
            'MediaServerPlugin'
        ]) {
            expect(plugins).toContain(name);
        }
    });
});

describe('with a copilot provider', () => {
    beforeEach(() => scaffold('media-local', 'rest', 'copilot-anthropic'));

    it('adds the chosen backend', () => {
        expect(Object.keys(manifest().dependencies)).toContain(
            '@orthacms/copilot-provider-anthropic'
        );
    });

    it('does not install the provider that was not chosen', () => {
        expect(Object.keys(manifest().dependencies)).not.toContain(
            '@orthacms/copilot-provider-openai'
        );
    });

    it('builds only the chosen provider in the registration helper', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).toContain('createAnthropicProvider');
        expect(plugins).not.toContain('createOpenAiProvider');
    });

    /**
     * `fake` is a shipped adapter, not test scaffolding: it needs no key and no
     * network, so it is what makes the chat work with nothing configured — and
     * being last it is the default only when it is the only one.
     */
    it('always registers the offline provider, last', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).toContain('createFakeProvider');
        expect(plugins.indexOf('createFakeProvider()')).toBeGreaterThan(
            plugins.indexOf('createAnthropicProvider')
        );
    });

    it('writes the provider’s env keys', () => {
        expect(rendered('.env')).toContain('ANTHROPIC_API_KEY=');
        expect(rendered('.env')).not.toContain('COPILOT_OPENAI_BASE_URL');
    });

    it('keeps the copilot off until an operator opts in', () => {
        expect(rendered('.env')).toContain('COPILOT_ENABLED=false');
    });
});

describe('with both copilot providers', () => {
    beforeEach(() =>
        scaffold('media-local', 'rest', 'copilot-anthropic', 'copilot-openai')
    );

    it.each(COPILOT_PROVIDERS.map((provider) => provider.packages[0]))(
        'installs %s',
        (name) => {
            expect(Object.keys(manifest().dependencies)).toContain(name);
        }
    );

    it('registers both in the helper', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).toContain('createAnthropicProvider');
        expect(plugins).toContain('createOpenAiProvider');
    });
});

describe('with every protocol', () => {
    beforeEach(() => scaffold('media-local', 'rest', 'graphql', 'mcp'));

    it('installs and registers GraphQL', () => {
        expect(Object.keys(manifest().dependencies)).toContain(
            '@orthacms/content-graphql'
        );
        expect(rendered('src/server/plugins.ts')).toContain(
            'ContentGraphqlPlugin'
        );
    });

    it('installs and registers MCP', () => {
        expect(Object.keys(manifest().dependencies)).toContain(
            '@orthacms/mcp-server'
        );
        expect(rendered('src/server/plugins.ts')).toContain('McpPlugin');
    });

    it('keeps MCP off until an operator opts in', () => {
        expect(rendered('.env')).toContain('MCP_ENABLED=false');
    });

    /**
     * The GraphQL adapter takes the content plugin **by value**, so it can fail
     * boot on two content types that would collide as GraphQL names rather than
     * on the first request from a workspace granted both.
     */
    it('hands the content plugin to the GraphQL adapter', () => {
        const plugins = rendered('src/server/plugins.ts');

        expect(plugins).toContain('const content = ContentPlugin(');
        expect(plugins).toContain('content,');
    });
});
