import type { AnyColumn, Table } from 'drizzle-orm';

/** Named constants for `FilterOperator` — use in switches and comparisons. */
export const FilterOperator = {
    Eq: 'eq',
    Ne: 'ne',
    Gt: 'gt',
    Gte: 'gte',
    Lt: 'lt',
    Lte: 'lte',
    In: 'in',
    Nin: 'nin',
    Like: 'like',
    Ilike: 'ilike',
    Null: 'null'
} as const;

/** Standard REST operator names. Translator maps each to a Drizzle helper. */
export type FilterOperator =
    (typeof FilterOperator)[keyof typeof FilterOperator];

/** Named constants for `ScalarFieldType` — use in switches. */
export const ScalarFieldType = {
    String: 'string',
    Number: 'number',
    Boolean: 'boolean',
    Uuid: 'uuid',
    Date: 'date',
    Enum: 'enum'
} as const;

/** How the parser coerces raw URL string values. */
export type ScalarFieldType =
    (typeof ScalarFieldType)[keyof typeof ScalarFieldType];

/** Named constants for `RelationSchema['kind']` — use in switches. */
export const RelationKind = {
    OneToOne: 'one-to-one',
    OneToMany: 'one-to-many',
    ManyToOne: 'many-to-one',
    ManyToMany: 'many-to-many',
    SelfReferential: 'self-referential'
} as const;

/** Relation cardinality discriminants. */
export type RelationKind = (typeof RelationKind)[keyof typeof RelationKind];

/** Coercion rules for one column. Any declared field accepts any operator. */
export interface ScalarFieldSchema {
    /** How incoming strings are coerced before hitting Drizzle. */
    type: ScalarFieldType;
    /** Required when `type === 'enum'`. */
    enumValues?: readonly string[];
}

/** Columns exposed on one table. */
export type FieldSchema = Record<string, ScalarFieldSchema>;

/**
 * Relation descriptor. `kind` discriminates the SQL shape the translator
 * emits (EXISTS, EXISTS + INNER JOIN, aliased self-join).
 */
export type RelationSchema =
    | {
          /** Target FK references parent — one row (1:1) or many (1:N). */
          kind: 'one-to-one' | 'one-to-many';
          /** Target table containing the FK. */
          table: Table;
          /** Column on `table` referencing parent's primary key. */
          fk: AnyColumn;
          /** Parent primary key — defaults to `parent.id`. */
          parentKey?: AnyColumn;
          fields?: FieldSchema;
          relations?: Record<string, RelationSchema>;
      }
    | {
          /** Parent FK references target. */
          kind: 'many-to-one';
          /** Target table. */
          table: Table;
          /** Column on the parent table referencing target's primary key. */
          fk: AnyColumn;
          /** Target primary key — defaults to `target.id`. */
          targetKey?: AnyColumn;
          fields?: FieldSchema;
          relations?: Record<string, RelationSchema>;
      }
    | {
          /** Many rows link parent to target through a junction table. */
          kind: 'many-to-many';
          /** Junction (through) table. */
          through: Table;
          /** Junction column referencing parent's primary key. */
          fk: AnyColumn;
          /** Junction column referencing target's primary key. */
          targetFk: AnyColumn;
          /** Target table — required when filtering on target fields. */
          table?: Table;
          parentKey?: AnyColumn;
          targetKey?: AnyColumn;
          fields?: FieldSchema;
          relations?: Record<string, RelationSchema>;
      }
    | {
          /** Parent references another row in the same table. */
          kind: 'self-referential';
          /** Same physical table as the parent. */
          table: Table;
          /** Column on the parent referencing its own primary key. */
          fk: AnyColumn;
          /** Alias used for the self-joined table inside the subquery. */
          alias: string;
          fields?: FieldSchema;
          relations?: Record<string, RelationSchema>;
      };

/** Public filter surface for one endpoint. */
export interface FilterSchema {
    /** Scalar columns on the root table. */
    fields?: FieldSchema;
    /** Relations traversable from the root table. */
    relations?: Record<string, RelationSchema>;
    /**
     * Field names that should be routed through a host-supplied
     * `resolveExtension` hook instead of the standard scalar / relation
     * translator. Lets a downstream plugin contribute a "virtual"
     * field — e.g. `role` on the user filter — that resolves to a
     * subquery the host stitches into the WHERE tree.
     *
     * Each entry MUST also have a corresponding declaration under
     * {@link fields} so the parser can validate the leaf's value
     * against a {@link ScalarFieldSchema}. The set is consulted only
     * by the translator, not by `parseFilterTree`.
     */
    extensionFields?: ReadonlySet<string>;
    /** Maximum dotted-path depth. Defaults to 3. */
    maxDepth?: number;
    /**
     * Maximum total number of rules + groups in a tree-shaped filter.
     * Defaults to 50. Guards against pathological JSON payloads that
     * would otherwise translate into very large SQL trees.
     */
    maxNodes?: number;
    /**
     * Maximum nesting depth of `and`/`or` groups in a tree-shaped filter.
     * Defaults to 5. Independent of {@link maxDepth} (which limits
     * dotted-path depth on a single rule).
     */
    maxGroupDepth?: number;
}

/** Parser output, one node per URL filter entry. */
export interface ParsedFilter {
    /** Dotted path split into segments, e.g. `['workspaces','name']`. */
    path: string[];
    /** Requested operator. */
    op: FilterOperator;
    /** Coerced to the declared type; array for `in`/`nin`, boolean for `null`. */
    value: unknown;
}

/** Tree-shaped parser output — leaf rule, type-tagged for the union. */
export interface ParsedRule extends ParsedFilter {
    kind: 'rule';
}

/** Tree-shaped parser output — group node combining children with AND or OR. */
export interface ParsedGroup {
    kind: 'group';
    combinator: 'and' | 'or';
    children: ParsedNode[];
}

/**
 * Tree-shaped parser output. `parseFilterTree` returns a `ParsedGroup`
 * root (or null when the input is empty); the translator walks this
 * tree directly into Drizzle SQL.
 */
export type ParsedNode = ParsedRule | ParsedGroup;
