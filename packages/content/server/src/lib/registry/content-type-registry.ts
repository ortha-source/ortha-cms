/**
 * The runtime registry of code-defined content types. Constructed once by
 * the plugin factory, validated eagerly (duplicate names, unresolvable
 * relation targets fail boot — not first request), and provided via DI so
 * controllers, services, and other plugins can introspect the schema.
 */

import type { AnyContentType, ContentTypeKind } from '../types/content-type';

/** Wire shape of a field, as served to the admin / frontends. */
export interface SerializedField {
    name: string;
    type: string;
    required: boolean;
    localized: boolean;
    ai: boolean;
    validation: Record<string, unknown>;
    admin: Record<string, unknown>;
    options?: readonly string[];
    relation?: { to: string; many: boolean; onDelete: string };
}

/** Wire shape of a content type (summary, wizard-compatible). */
export interface SerializedContentTypeSummary {
    name: string;
    kind: ContentTypeKind;
    label: string;
    description?: string;
    path?: string;
}

/** Wire shape of a content type with its full field schema. */
export interface SerializedContentType extends SerializedContentTypeSummary {
    fields: SerializedField[];
}

export class ContentTypeRegistry {
    private readonly byName = new Map<string, AnyContentType>();

    constructor(types: readonly AnyContentType[]) {
        for (const type of types) {
            if (this.byName.has(type.name)) {
                throw new Error(
                    `Duplicate content type "${type.name}" — names must be unique.`
                );
            }
            this.byName.set(type.name, type);
        }
        // Resolve every relation thunk now: a typo'd target or a type
        // missing from `ContentPlugin({ types })` should fail boot.
        for (const type of types) {
            for (const [fieldName, spec] of Object.entries(type.fields)) {
                if (spec.type !== 'relation' || !spec.relation) continue;
                const target = spec.relation.to();
                if (!this.byName.has(target.name)) {
                    throw new Error(
                        `Relation "${type.name}.${fieldName}" targets ` +
                            `"${target.name}", which is not registered with ContentPlugin.`
                    );
                }
            }
        }
    }

    /** All registered types, in registration order. */
    all(): AnyContentType[] {
        return [...this.byName.values()];
    }

    /** A type by machine name, or undefined. */
    get(name: string): AnyContentType | undefined {
        return this.byName.get(name);
    }

    /** Wizard-compatible summaries (matches `ContentTypeDescriptor`). */
    summaries(): SerializedContentTypeSummary[] {
        return this.all().map((type) => ({
            name: type.name,
            kind: type.kind,
            label: type.label,
            ...(type.description ? { description: type.description } : {}),
            ...(type.path ? { path: type.path } : {})
        }));
    }

    /** Full serialized schema for one type, or undefined. */
    serialize(name: string): SerializedContentType | undefined {
        const type = this.get(name);
        if (!type) return undefined;
        return {
            ...this.summaries().find((s) => s.name === name)!,
            fields: Object.entries(type.fields).map(([fieldName, spec]) => ({
                name: fieldName,
                type: spec.type,
                required: spec.required,
                localized: spec.localized,
                ai: spec.ai,
                validation: { ...spec.validation },
                admin: { ...spec.admin },
                ...(spec.options ? { options: spec.options } : {}),
                ...(spec.relation
                    ? {
                          relation: {
                              to: spec.relation.to().name,
                              many: spec.relation.many,
                              onDelete: spec.relation.onDelete
                          }
                      }
                    : {})
            }))
        };
    }
}
