import type { RuleField, RuleType } from '../rule-type';
import type { SetRule } from '../rule';
import { fieldPath, issue, type SchemaIssue } from '../schema-issue';

/**
 * Every relation targets a registered type, and every inverse mirrors a
 * storage-owning relation on its target that points back here — otherwise the
 * two sides would edit different links. Field by field, target before inverse:
 * the order the registry has always reported them in.
 */
export const checkRelationLinks: SetRule = (types) => {
    const byName = new Map(types.map((type) => [type.name, type]));
    const issues: SchemaIssue[] = [];
    for (const type of types) {
        for (const [name, field] of Object.entries(type.fields)) {
            issues.push(...linkIssues(type, name, field, byName));
        }
    }
    return issues;
};

function linkIssues(
    type: RuleType,
    name: string,
    field: RuleField,
    byName: Map<string, RuleType>
): SchemaIssue[] {
    const rel = field.relation;
    if (field.type !== 'relation' || !rel) return [];
    const path = fieldPath(type.name, name);
    const target = byName.get(rel.to);
    if (!target) {
        return [
            issue(
                path,
                'relation.unknown-target',
                `Relation "${type.name}.${name}" targets ` +
                    `"${rel.to}", which is not registered with ContentPlugin.`
            )
        ];
    }
    if (!rel.inverse) return [];

    const owning = target.fields[rel.inverse.field];
    if (
        !owning ||
        owning.type !== 'relation' ||
        !owning.relation ||
        owning.relation.inverse
    ) {
        return [
            issue(
                path,
                'relation.inverse-not-owning',
                `Inverse relation "${type.name}.${name}" references ` +
                    `"${target.name}.${rel.inverse.field}", which is not ` +
                    `a storage-owning relation field.`
            )
        ];
    }
    if (owning.relation.to !== type.name) {
        return [
            issue(
                path,
                'relation.inverse-mismatch',
                `Inverse relation "${type.name}.${name}" mirrors ` +
                    `"${target.name}.${rel.inverse.field}", but that field ` +
                    `targets "${owning.relation.to}", not "${type.name}".`
            )
        ];
    }
    return [];
}
