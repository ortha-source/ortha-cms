import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync
} from 'node:fs';
import { join, relative } from 'node:path';

/** The values substituted into the template's placeholders. */
export interface TemplateValues {
    /** npm package name for the generated app. */
    appName: string;
    /** Human-readable name, used in the page title and the README. */
    appTitle: string;
    /** Postgres connection string. */
    databaseUrl: string;
    /** Database name, so `docker-compose.yml` creates the right one. */
    databaseName: string;
    /** Email of the admin provisioned on first boot. */
    adminEmail: string;
    /** Password for that admin. */
    adminPassword: string;
    /** The `@orthacms/*` version every dependency is pinned to. */
    orthaVersion: string;
}

/**
 * Files that are renamed on their way out of the template.
 *
 * `.gitignore` is the one that matters: **npm refuses to publish a file by
 * that name**, silently, so a template carrying one ships without it and every
 * generated app starts by offering to commit `node_modules`. Storing it as
 * `_gitignore` is the standard workaround (create-vite and create-next-app do
 * the same). The `.tmpl` suffixes are a smaller thing — they keep a
 * `package.json` out of the workspace globs that would otherwise read the
 * template directory as a package of its own.
 */
const RENAMES: Readonly<Record<string, string>> = {
    _gitignore: '.gitignore',
    'env.tmpl': '.env',
    'package.json.tmpl': 'package.json',
    'README.md.tmpl': 'README.md'
};

/** Substitutes every `__PLACEHOLDER__` in `contents`. */
export function render(contents: string, values: TemplateValues): string {
    const replacements: Record<string, string> = {
        __APP_NAME__: values.appName,
        __APP_TITLE__: values.appTitle,
        __DATABASE_URL__: values.databaseUrl,
        __DATABASE_NAME__: values.databaseName,
        __ADMIN_EMAIL__: values.adminEmail,
        __ADMIN_PASSWORD__: values.adminPassword,
        __ORTHA_VERSION__: values.orthaVersion
    };

    return Object.entries(replacements).reduce(
        (text, [token, value]) => text.split(token).join(value),
        contents
    );
}

/** File extensions rendered as text; everything else is copied byte for byte. */
const TEXT =
    /\.(ts|tsx|css|html|json|md|yml|yaml|tmpl|mjs|cjs|js)$|^_gitignore$/;

/** Every file under `dir`, recursively, as paths relative to it. */
function filesIn(dir: string, base = dir): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        return entry.isDirectory()
            ? filesIn(path, base)
            : [relative(base, path)];
    });
}

/**
 * Copies the template into `target`, substituting placeholders and applying
 * the renames above.
 *
 * Text files go through {@link render} and binary ones are copied verbatim —
 * a distinction worth keeping even though today's template is all text, since
 * running a favicon through a string replace corrupts it in a way that only
 * shows up in a browser.
 */
export function renderTemplate(
    templateDir: string,
    target: string,
    values: TemplateValues
): void {
    for (const file of filesIn(templateDir)) {
        const source = join(templateDir, file);
        const name = file.split('/').pop() ?? file;
        const renamed = RENAMES[name];
        const destination = join(
            target,
            renamed ? join(file, '..', renamed) : file
        );

        mkdirSync(join(destination, '..'), { recursive: true });

        if (TEXT.test(name)) {
            writeFileSync(
                destination,
                render(readFileSync(source, 'utf8'), values)
            );
        } else {
            cpSync(source, destination);
        }
    }
}

/** Whether `dir` exists and holds anything. */
export function isNonEmptyDirectory(dir: string): boolean {
    return (
        existsSync(dir) &&
        statSync(dir).isDirectory() &&
        readdirSync(dir).length > 0
    );
}
