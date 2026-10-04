import {
    joinExportName,
    REVISIONS_EXPORT,
    tableExportName
} from './export-names';
import { contentFolder, type ManifestEntry } from './manifest-entry';
import { sortEntries } from './sort-entries';

/** The first line of every file this package writes. */
export const MANIFEST_MARKER = '// @orthacms-generated';

const HEADER = `${MANIFEST_MARKER} — the content manifest. Do not edit by hand.
//
// Regenerate it with \`orthacms content sync\` (in this monorepo:
// \`npx nx run server:content:sync\`) after adding, renaming or removing a file
// under collections/ or pages/. The schema builder rewrites it on every apply.
//
// Two readers: plugins.ts registers \`contentTypes\` with ContentPlugin, and
// drizzle-kit diffs every top-level table export below into migrations.`;

/**
 * \`src/content/index.ts\` for a set of content types. Deterministic: the same
 * entries always render the same text, already formatted the way prettier
 * leaves it, so a sync never shows up in a diff on its own.
 */
export function renderManifest(entries: readonly ManifestEntry[]): string {
    const sorted = sortEntries(entries);
    const lines: string[] = [HEADER, ''];

    lines.push(
        'import {',
        '    contentEntryRevisions,',
        ...(sorted.some((e) => e.joinFields.length)
            ? ['    joinTableOf,']
            : []),
        '    type AnyContentType',
        "} from '@orthacms/content-server/define';",
        ...sorted.map(
            (e) =>
                `import { ${e.name} } from './${contentFolder(e.kind)}/${e.name}';`
        ),
        ''
    );

    lines.push(
        '/** Every content type registered with ContentPlugin. */',
        sorted.length
            ? [
                  'export const contentTypes: readonly AnyContentType[] = [',
                  ...sorted.map(
                      (e, i) =>
                          `    ${e.name}${i < sorted.length - 1 ? ',' : ''}`
                  ),
                  '];'
              ].join('\n')
            : 'export const contentTypes: readonly AnyContentType[] = [];',
        ''
    );

    if (sorted.length) {
        lines.push(
            '/* Main tables — one `content_<name>` per type. */',
            ...sorted.map(
                (e) =>
                    `export const ${tableExportName(e.name)} = ${e.name}.table;`
            ),
            ''
        );
    }

    const joins = sorted.flatMap((e) =>
        e.joinFields.map((field) => ({ type: e.name, field }))
    );
    if (joins.length) {
        lines.push(
            '/* Join tables — one per many-relation. `joinTableOf` throws if one is gone. */',
            ...joins.map(({ type, field }) => joinLine(type, field)),
            ''
        );
    }

    lines.push(
        '/* The revision store — one fixed table, owned by content-server. */',
        `export const ${REVISIONS_EXPORT} = contentEntryRevisions;`,
        ''
    );
    return lines.join('\n');
}

/** Wrapped the way prettier wraps it at 80 columns, so the file never drifts. */
function joinLine(type: string, field: string): string {
    const single = `export const ${joinExportName(type, field)} = joinTableOf(${type}, '${field}');`;
    if (single.length <= 80) return single;
    return [
        `export const ${joinExportName(type, field)} = joinTableOf(`,
        `    ${type},`,
        `    '${field}'`,
        ');'
    ].join('\n');
}
