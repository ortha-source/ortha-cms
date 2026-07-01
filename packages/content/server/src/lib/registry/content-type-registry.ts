/**
 * The runtime registry of code-defined content types. Constructed once by
 * the plugin factory, validated eagerly (duplicate names, unresolvable
 * relation targets fail boot — not first request), and provided via DI so
 * controllers, services, and other plugins can introspect the schema.
 */

import type { AnyContentType, ContentTypeKind } from '../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../types/fields';

/** Wire shape of a field, as served to the admin / frontends. */
export interface SerializedField {
    name: string;
    type: string;
    required: boolean;
    validation: Record<string, unknown>;
    admin: Record<string, unknown>;
    options?: readonly string[];
    /**
     * `onDelete` and `unique` describe the FK column of a single relation —
     * meaningful only when `many` is false. For a many-relation the link lives
     * in a join table whose rows always cascade and have no column to make
     * unique, so both are omitted rather than reported as (inert) spec values.
     */
    relation?: {
        to: string;
        many: boolean;
        onDelete?: string;
        unique?: boolean;
        /** Present when this field is the inverse side of a two-way relation. */
        inverse?: { field: string };
    };
}

/** Wire shape of a content type (summary, wizard-compatible). */
export interface SerializedContentTypeSummary {
    name: string;
    kind: ContentTypeKind;
    label: string;
    description?: string;
    path?: string;
    /** Tracks publish time via a `publishedAt` envelope column. */
    publishable: boolean;
    /** Soft-deletes via a `deletedAt` envelope column. */
    paranoid: boolean;
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
                if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
                    continue;
                const target = spec.relation.to();
                if (!this.byName.has(target.name)) {
                    throw new Error(
                        `Relation "${type.name}.${fieldName}" targets ` +
                            `"${target.name}", which is not registered with ContentPlugin.`
                    );
                }
                // An inverse must point at a real relation on the owning type
                // (`target`) that in turn points back here — else the two sides
                // would edit different links. Fail boot on a mismatch.
                if (spec.relation.inverse) {
                    const owningField =
                        target.fields[spec.relation.inverse.field];
                    if (
                        !owningField ||
                        owningField.type !== CONTENT_FIELD_TYPE.Relation ||
                        !owningField.relation ||
                        owningField.relation.inverse
                    ) {
                        throw new Error(
                            `Inverse relation "${type.name}.${fieldName}" references ` +
                                `"${target.name}.${spec.relation.inverse.field}", which is not ` +
                                `a storage-owning relation field.`
                        );
                    }
                    if (owningField.relation.to().name !== type.name) {
                        throw new Error(
                            `Inverse relation "${type.name}.${fieldName}" mirrors ` +
                                `"${target.name}.${spec.relation.inverse.field}", but that field ` +
                                `targets "${owningField.relation.to().name}", not "${type.name}".`
                        );
                    }
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

    /** The wizard-compatible summary of one type. */
    private summaryOf(type: AnyContentType): SerializedContentTypeSummary {
        return {
            name: type.name,
            kind: type.kind,
            label: type.label,
            ...(type.description ? { description: type.description } : {}),
            ...(type.path ? { path: type.path } : {}),
            publishable: type.publishable,
            paranoid: type.paranoid
        };
    }

    /** The wire shape of one field spec. */
    private serializeField(
        fieldName: string,
        spec: AnyFieldSpec
    ): SerializedField {
        return {
            name: fieldName,
            type: spec.type,
            required: spec.required,
            validation: { ...spec.validation },
            admin: { ...spec.admin },
            ...(spec.options ? { options: spec.options } : {}),
            ...(spec.relation
                ? {
                      relation: {
                          to: spec.relation.to().name,
                          many: spec.relation.many,
                          // An inverse owns no column/table, so onDelete/unique
                          // are inert — report the back-reference instead.
                          ...(spec.relation.inverse
                              ? { inverse: { field: spec.relation.inverse.field } }
                              : spec.relation.many
                                ? {}
                                : {
                                      onDelete: spec.relation.onDelete,
                                      unique: spec.relation.unique
                                  })
                      }
                  }
                : {})
        };
    }

    /** Wizard-compatible summaries (matches `ContentTypeDescriptor`). */
    summaries(): SerializedContentTypeSummary[] {
        return this.all().map((type) => this.summaryOf(type));
    }

    /** Full serialized schema for one type, or undefined. */
    serialize(name: string): SerializedContentType | undefined {
        const type = this.get(name);
        if (!type) return undefined;
        return {
            ...this.summaryOf(type),
            fields: Object.entries(type.fields).map(([fieldName, spec]) =>
                this.serializeField(fieldName, spec)
            )
        };
    }
}
