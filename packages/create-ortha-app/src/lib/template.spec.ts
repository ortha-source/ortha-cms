import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render, renderTemplate } from './template';
import type { TemplateValues } from './template';

const TEMPLATE = join(__dirname, '../../templates/default');

const values: TemplateValues = {
    appName: 'my-cms',
    appTitle: 'My CMS',
    databaseUrl: 'postgresql://ortha:ortha@localhost:5432/my_cms',
    databaseName: 'my_cms',
    adminEmail: 'admin@example.com',
    adminPassword: 'hunter2',
    orthaVersion: '9.9.9'
};

let target: string;

beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), 'create-ortha-'));
});

afterEach(() => rmSync(target, { recursive: true, force: true }));

/** Reads a rendered file out of the scaffolded app. */
function rendered(path: string): string {
    return readFileSync(join(target, path), 'utf8');
}

describe('render', () => {
    it('substitutes every occurrence of a placeholder, not just the first', () => {
        expect(render('__APP_NAME__/__APP_NAME__', values)).toBe(
            'my-cms/my-cms'
        );
    });
});

describe('renderTemplate', () => {
    beforeEach(() => renderTemplate(TEMPLATE, target, values));

    it('pins every @orthacms dependency to this scaffolder’s version', () => {
        const manifest = JSON.parse(rendered('package.json')) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        const ortha = Object.entries({
            ...manifest.dependencies,
            ...manifest.devDependencies
        }).filter(([name]) => name.startsWith('@orthacms/'));

        expect(ortha.length).toBeGreaterThan(0);
        for (const [, range] of ortha) {
            expect(range).toBe('9.9.9');
        }
    });

    /**
     * The releases are lockstep, and a partial upgrade can leave two copies of
     * a shared package in `node_modules` — two React context instances, and a
     * UI that silently stops talking to itself. Exact pins are what make an
     * upgrade an all-or-nothing edit.
     */
    it('pins them exactly, with no caret', () => {
        const manifest = JSON.parse(rendered('package.json')) as {
            dependencies: Record<string, string>;
        };

        for (const [name, range] of Object.entries(manifest.dependencies)) {
            if (!name.startsWith('@orthacms/')) continue;
            expect(range.startsWith('^')).toBe(false);
        }
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
        expect(entries.filter((e) => e.endsWith('.tmpl'))).toEqual([]);
    });

    it('writes the database URL and its derived database name', () => {
        expect(rendered('.env')).toContain(
            'DATABASE_URL=postgresql://ortha:ortha@localhost:5432/my_cms'
        );
        expect(rendered('docker-compose.yml')).toContain('POSTGRES_DB: my_cms');
    });

    // ORT-149 — the generated `.env` used to carry two 256-bit secrets that
    // nothing read. Sessions and one-time tokens are opaque random values
    // checked against a row, so there is no key to place in a scaffolded app.
    it('scaffolds no signing secrets, because identity has none to sign with', () => {
        const env = rendered('.env');

        expect(env).not.toContain('SESSION_SECRET');
        expect(env).not.toContain('TOKEN_SECRET');
    });

    it('leaves no placeholder unsubstituted anywhere', () => {
        const files = [
            'package.json',
            '.env',
            'README.md',
            'index.html',
            'docker-compose.yml',
            'src/server/ortha.config.ts'
        ];

        for (const file of files) {
            expect(rendered(file)).not.toMatch(/__[A-Z_]+__/);
        }
    });

    it('scaffolds the files the CLI’s layout constants expect', () => {
        for (const file of [
            'tsconfig.server.json',
            'vite.config.ts',
            'src/server/main.ts',
            'src/server/plugins.ts',
            'src/server/ortha.config.ts',
            'src/admin/main.tsx',
            'src/admin/plugins.ts',
            'src/admin/styles.css'
        ]) {
            expect(() => rendered(file)).not.toThrow();
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
