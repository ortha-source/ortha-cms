import type { SchemaChange } from '@orthacms/schema-builder-domain';

/** The shape the server takes: it ends up in a file name. */
export const MIGRATION_NAME = /^[a-z][a-z0-9_]{0,59}$/;

/** `text` as a migration name fragment: lowercase, underscores, no leading digit. */
const slug = (text: string) =>
    text
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

/** What one change is called in a migration name. */
function nameOf(change: SchemaChange): string {
    switch (change.kind) {
        case 'type.add':
            return `add_${change.type}`;
        case 'type.remove':
            return `remove_${change.type}`;
        case 'field.add':
            return `add_${change.type}_${slug(change.field)}`;
        case 'field.remove':
            return `remove_${change.type}_${slug(change.field)}`;
        default:
            return `update_${change.type}`;
    }
}

/**
 * A migration name for a set of changes — the first change's, or a summary
 * when there are several types involved. Always matches {@link MIGRATION_NAME}.
 */
export function suggestMigrationName(changes: readonly SchemaChange[]): string {
    const types = new Set(changes.map((change) => change.type));
    const raw =
        changes.length === 1
            ? nameOf(changes[0])
            : types.size === 1
              ? `update_${[...types][0]}`
              : 'update_content_model';
    const name = slug(raw).slice(0, 60);
    return MIGRATION_NAME.test(name) ? name : `m_${name}`.slice(0, 60);
}
