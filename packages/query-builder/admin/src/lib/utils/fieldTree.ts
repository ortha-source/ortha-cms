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

/**
 * A named bucket of the collection's **own** fields — not a relation, and not
 * traversable.
 *
 * It exists for fields that belong together but share no path: the virtual
 * fields a plugin contributes (segments' "Can be seen by" / "Cannot be seen by"
 * / "Access restricted"). Those are answered by a subquery over a table with no
 * content model behind it, so they are flat by necessity — and left ungrouped
 * they scatter through the collection's own scalars, where a reader has to know
 * the feature exists to recognise them as one thing.
 */
export type CategoryNode = {
    /** Stable key — the label's message id. */
    key: string;
    label: MessageDescriptor;
    fields: FilterField[];
};

/** The collection's own scalar fields, its named categories, and its relations. */
export type FieldTree = {
    fields: FilterField[];
    categories: CategoryNode[];
    relations: RelationNode[];
};

/**
 * Reconstruct the relation tree from the flat `FilterField[]` the server
 * serves. Each field's `id` is a dotted path (`author.company.name`) and its
 * `group` is the matching breadcrumb of relation labels, so the leading
 * segments name the relations and the last names the leaf; the two align by
 * index. The server already guards relation cycles (it never expands a path
 * back to an ancestor type), so this walk terminates on whatever depth the
 * server chose to surface.
 *
 * A field with **no** relation segments is one of the collection's own, and
 * `group` means something else there: it names a {@link CategoryNode}, a plain
 * bucket in the picker. That second reading is deliberate rather than an
 * overload to regret — in both cases `group` answers "under what heading does
 * this field belong", and the `id` is what says whether the heading is a
 * traversable relation or just a heading. Giving flat fields a `category` of
 * their own would have been a second field meaning the same thing, with the
 * search breadcrumb then having to read both.
 *
 * A flat field with no `group` stays a root scalar, which is every field the
 * server derives from the type itself.
 */
export function buildFieldTree(fields: readonly FilterField[]): FieldTree {
    const tree: FieldTree = { fields: [], categories: [], relations: [] };
    const byKey = new Map<string, RelationNode>();
    const categoriesByKey = new Map<string, CategoryNode>();

    /** The bucket named by a flat field's first crumb, created on first use. */
    const ensureCategory = (label: MessageDescriptor): CategoryNode => {
        let existing = categoriesByKey.get(label.id as string);
        if (!existing) {
            existing = { key: label.id as string, label, fields: [] };
            categoriesByKey.set(label.id as string, existing);
            // Registration order, so a plugin's fields sit where its
            // contribution was registered rather than in whatever order a
            // sort would invent.
            tree.categories.push(existing);
        }
        return existing;
    };

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
            // Only the first crumb is read: a category is one level. Nesting
            // them would be a tree feature, and the thing that legitimately
            // nests here is a relation, which has a path to prove it.
            const category = field.group?.[0];
            if (category) ensureCategory(category).fields.push(field);
            else tree.fields.push(field);
            continue;
        }
        const node = ensureRelation(relationSegments, field.group ?? []);
        node?.fields.push(field);
    }

    return tree;
}
