import type { MessageDescriptor } from 'react-intl';
import type { FilterField } from '../types/filter-field.type';

/**
 * A relation node in the field tree — a traversable relation and everything
 * reachable through it. `key` is the dotted relation path (`author.company`);
 * `fields` are the scalar (and record-picker `id`) leaves directly on this
 * relation; `relations` are its own nested relations, recursively.
 */
export type RelationNode = {
    key: string;
    label: MessageDescriptor;
    fields: FilterField[];
    relations: RelationNode[];
};

/** The collection's own scalar fields plus its traversable relations. */
export type FieldTree = {
    fields: FilterField[];
    relations: RelationNode[];
};

/**
 * Reconstruct the relation tree from the flat `FilterField[]` the server
 * serves. Each field's `id` is a dotted path (`author.company.name`) and its
 * `group` is the matching breadcrumb of relation labels, so the leading
 * segments name the relations and the last names the leaf; the two align by
 * index. A field with no relation segments is a root scalar. The server already
 * guards relation cycles (it never expands a path back to an ancestor type), so
 * this walk terminates on whatever depth the server chose to surface.
 */
export function buildFieldTree(fields: readonly FilterField[]): FieldTree {
    const tree: FieldTree = { fields: [], relations: [] };
    const byKey = new Map<string, RelationNode>();

    const ensureRelation = (
        segments: string[],
        labels: readonly MessageDescriptor[]
    ): RelationNode | null => {
        let siblings = tree.relations;
        let node: RelationNode | null = null;
        let keyAcc = '';
        for (let i = 0; i < segments.length; i++) {
            keyAcc = keyAcc ? `${keyAcc}.${segments[i]}` : segments[i];
            let existing = byKey.get(keyAcc);
            if (!existing) {
                existing = {
                    key: keyAcc,
                    label: labels[i] ?? {
                        id: `qb.field.relation.${keyAcc}`,
                        defaultMessage: segments[i]
                    },
                    fields: [],
                    relations: []
                };
                byKey.set(keyAcc, existing);
                siblings.push(existing);
            }
            siblings = existing.relations;
            node = existing;
        }
        return node;
    };

    for (const field of fields) {
        const segments = field.id.split('.');
        const relationSegments = segments.slice(0, -1);
        if (relationSegments.length === 0) {
            tree.fields.push(field);
            continue;
        }
        const node = ensureRelation(relationSegments, field.group ?? []);
        node?.fields.push(field);
    }

    return tree;
}
