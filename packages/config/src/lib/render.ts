import { RENAMED } from '@orthacms/utils-server';

import {
    ENV_CATALOG,
    ENV_GROUPS,
    type EnvGroup,
    type EnvVarSpec
} from './catalog';
import { RETIRED_ENV } from './retired';

const WIDTH = 80;

/** Wraps `text` into `# `-prefixed comment lines no wider than {@link WIDTH}. */
function comment(text: string): string[] {
    const lines: string[] = [];
    let line = '#';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line.length + 1 + word.length > WIDTH && line !== '#') {
            lines.push(line);
            line = '#';
        }
        line += ` ${word}`;
    }
    if (line !== '#') {
        lines.push(line);
    }
    return lines;
}

/** The line that assigns (or, commented out, illustrates) one variable. */
function assignment(spec: EnvVarSpec, active?: string): string {
    if (active !== undefined) {
        return `${spec.name}=${active}`;
    }
    return `# ${spec.name}=${spec.default ?? spec.example ?? ''}`;
}

/** How {@link renderEnvFile} lays a file out. */
export interface RenderEnvOptions {
    /**
     * Which variables to include. A set of feature ids keeps the variables
     * with no `features` plus those naming one of the set; `'template'` keeps
     * everything an app could read and wraps feature variables in
     * `orthacms:if` blocks for the scaffolder to resolve.
     */
    readonly features: ReadonlySet<string> | 'template';
    /**
     * Variables written uncommented, with this value. Everything else is a
     * commented line showing the default or an example, so a fresh copy boots
     * on defaults and a line someone uncomments is a decision they made.
     */
    readonly active?: Readonly<Record<string, string>>;
    /** Lines above the first section. */
    readonly header: readonly string[];
}

/** The variables `features` selects, in catalog order. */
export function selectEnv(features: ReadonlySet<string>): EnvVarSpec[] {
    return ENV_CATALOG.filter(
        (spec) => !spec.features || spec.features.some((id) => features.has(id))
    );
}

/** One variable's block: its summary as a comment, then its line. */
function block(spec: EnvVarSpec, options: RenderEnvOptions): string[] {
    const required =
        spec.required === 'production'
            ? ' Required in production.'
            : spec.required === 'feature'
              ? ' Required with this backend.'
              : '';
    return [
        ...comment(spec.summary + required),
        assignment(spec, options.active?.[spec.name])
    ];
}

/**
 * A `.env`-shaped file listing the catalog: the repository's `.env.example`
 * and, with `features: 'template'`, the scaffolder's `env.tmpl`.
 */
export function renderEnvFile(options: RenderEnvOptions): string {
    const out: string[] = [...options.header];
    const groups = Object.keys(ENV_GROUPS) as EnvGroup[];
    for (const group of groups) {
        const specs =
            options.features === 'template'
                ? ENV_CATALOG.filter(
                      (spec) =>
                          spec.group === group &&
                          !spec.features?.includes('workspace')
                  )
                : selectEnv(options.features).filter(
                      (spec) => spec.group === group
                  );
        if (specs.length === 0) {
            continue;
        }
        out.push('', `# --- ${ENV_GROUPS[group]} ---`);
        for (const spec of specs) {
            if (options.features !== 'template' || !spec.features) {
                out.push(...block(spec, options));
                continue;
            }
            // `orthacms:if` takes one flag, so a variable several features
            // read is written once per feature. The features that share one
            // (the storage adapters) are a single choice, so at most one block
            // survives rendering.
            for (const feature of spec.features) {
                out.push(
                    `# orthacms:if ${feature}`,
                    ...block(spec, options),
                    '# orthacms:end'
                );
            }
        }
    }
    return `${out.join('\n')}\n`;
}

/** Escapes a table cell. */
function cell(text: string): string {
    return text.replace(/\|/g, '\\|');
}

/**
 * A Markdown table with every column padded to its widest cell — the layout
 * Prettier writes, so the generated file survives a format pass unchanged.
 */
function table(header: readonly string[], rows: readonly string[][]): string[] {
    const widths = header.map((title, column) =>
        Math.max(
            3,
            title.length,
            ...rows.map((row) => row[column]?.length ?? 0)
        )
    );
    const line = (cells: readonly string[]) =>
        `| ${cells.map((text, column) => text.padEnd(widths[column] ?? 0)).join(' | ')} |`;
    return [
        line(header),
        line(widths.map((width) => '-'.repeat(width))),
        ...rows.map(line)
    ];
}

/** When a variable must be set, in words. */
function requirement(spec: EnvVarSpec): string {
    switch (spec.required) {
        case 'always':
            return 'always';
        case 'production':
            return 'in production';
        case 'feature':
            return 'when installed';
        default:
            return '';
    }
}

/** `docs/configuration.md`: every variable, grouped, with its rules. */
export function renderConfigReference(): string {
    const out: string[] = [
        '# Configuration reference',
        '',
        '<!-- Generated from packages/config/src/lib/catalog.ts by `ORTHACMS_WRITE_GENERATED=1 npx nx test config`. Edit the catalog, not this file. -->',
        '',
        'Every environment variable an Ortha CMS server reads. Settings that almost',
        'no deployment changes — TTLs, rate limits, GraphQL cost budgets, retry counts —',
        'are not environment variables: they are literals in the app’s own',
        '`apps/server/config/`, next to the plugin they configure.',
        '',
        '- **Empty means unset.** `KEY=` is the same as no line at all.',
        '- **Any variable can come from a file**: set `NAME_FILE=/run/secrets/name` and',
        '  leave `NAME` unset. That is how Docker and Kubernetes secrets reach the app.',
        '- **Values are checked at boot.** A number that is not a plain positive integer,',
        '  a flag that is not `true`/`false`/`1`/`0`, a value outside a list, a URL',
        '  without a scheme — each refuses to start, naming the variable.',
        '- **`orthacms setup`** writes these for you and checks each one;',
        '  **`orthacms doctor`** shows what is in effect and where it came from.',
        ''
    ];
    const groups = Object.keys(ENV_GROUPS) as EnvGroup[];
    for (const group of groups) {
        const specs = ENV_CATALOG.filter((spec) => spec.group === group);
        out.push(`## ${ENV_GROUPS[group]}`, '');
        out.push(
            ...table(
                ['Variable', 'Default', 'Required', 'What it is'],
                specs.map((spec) => [
                    `\`${spec.name}\``,
                    spec.default ? `\`${cell(spec.default)}\`` : '',
                    requirement(spec),
                    cell(spec.summary) +
                        (spec.values
                            ? ` One of ${spec.values.map((value) => `\`${value}\``).join(', ')}.`
                            : '')
                ])
            )
        );
        const detailed = specs.filter((spec) => spec.details);
        if (detailed.length > 0) {
            out.push('');
            for (const spec of detailed) {
                out.push(`- **\`${spec.name}\`** — ${spec.details}`);
            }
        }
        out.push('');
    }
    out.push('## Renamed', '');
    out.push(
        'Still read under the old name, with a warning at boot. The new name wins when both are set.',
        ''
    );
    const renamed: string[][] = [];
    for (const [current, previous] of Object.entries(RENAMED)) {
        for (const name of previous) {
            renamed.push([`\`${name}\``, `\`${current}\``]);
        }
    }
    renamed.push(
        [
            '`ALLOWED_ORIGINS`',
            '`PUBLIC_URL`, plus `EXTRA_ORIGINS` for any other address'
        ],
        [
            '`MAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_REQUIRE_TLS`',
            '`MAIL_URL`'
        ]
    );
    out.push(...table(['Old name', 'New name'], renamed), '');
    out.push('## No longer read from the environment', '');
    out.push(
        'Set to its old default, a variable below only logs a warning — remove the line. Set to anything else, the server refuses to start and says where the value goes now, because ignoring it would change the deployment without a word.',
        ''
    );
    out.push(
        ...table(
            ['Variable', 'Old default', 'Set it in'],
            Object.entries(RETIRED_ENV).map(([name, retired]) => [
                `\`${name}\``,
                retired.default ? `\`${retired.default}\`` : '',
                retired.movedTo
            ])
        )
    );
    return `${out.join('\n')}\n`;
}
