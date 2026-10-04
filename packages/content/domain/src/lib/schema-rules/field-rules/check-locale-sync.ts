import type { FieldRule } from '../rule';
import { fieldPath, issue, type SchemaIssue } from '../schema-issue';

/**
 * Locale propagation of a relation's links:
 * - on a type with no locale siblings, an explicit `syncAcrossLocales: false`
 *   can only mislead (the builder defaults it to `true`, so only a deliberate
 *   `false` is detectable);
 * - `localized: true` IS `syncAcrossLocales: false`, so asking for both
 *   contradicts itself.
 */
export const checkLocaleSync: FieldRule = (type, name, field) => {
    const rel = field.relation;
    if (field.type !== 'relation' || !rel || rel.inverse) return [];
    const path = fieldPath(type.name, name);
    const issues: SchemaIssue[] = [];

    if (!rel.syncAcrossLocales && !field.localized && !type.i18n) {
        issues.push(
            issue(
                path,
                'relation.sync-without-i18n',
                `Relation "${type.name}.${name}" sets syncAcrossLocales, but ` +
                    `"${type.name}" does not set i18n: true — it has no locale ` +
                    `siblings to propagate to.`
            )
        );
    }
    if (field.localized && rel.syncAcrossLocales) {
        issues.push(
            issue(
                path,
                'relation.localized-sync',
                `Relation "${type.name}.${name}" sets localized: true with ` +
                    `syncAcrossLocales: true — localized means each locale keeps ` +
                    `its own links, which is the opposite. Drop one of them.`
            )
        );
    }
    return issues;
};
