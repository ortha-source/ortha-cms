import type { AnyColumn, SQL, Table } from 'drizzle-orm';
import type { TableLike } from './table-helpers';

/**
 * Builds a relation's `scope` predicate — the workspace + soft-delete
 * guard ANDed inside its EXISTS subquery. It is a function, not a
 * prebuilt `SQL`, because the table it must reference is not always the
 * physical target: a `self-referential` relation aliases the target, and
 * the predicate has to bind to that alias, not the outer table of the
 * same name. The translator passes whichever table it actually queries
 * (aliased or not), so the host resolves columns from that — e.g. via
 * `getTableColumns(target)`. Return `undefined` to add nothing.
 */
export type RelationScope = (target: TableLike) => SQL | undefined;

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
    Nilike: 'nilike',
    Null: 'null',
    /**
     * `column >= now() - <n> <unit>` — a window measured from **query time**,
     * not from the moment the filter was written.
     *
     * The distinction is invisible in a URL and decisive in a stored one. The
     * admin's query builder resolves its own `within_last` into a concrete
     * `gte` cutoff when it serialises a filter into a link, deliberately: a
     * shared deep link should keep showing the same rows. A filter that is
     * *stored and replayed* — an alarm rule — must mean the opposite, or
     * "not updated in 90 days" silently becomes "not updated since the day the
     * rule was written". So the operator survives to the server, and the caller
     * chooses which meaning it wants.
     */
    WithinLast: 'within_last'
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

/**
 * Coercion rules for one column.
 *
 * The declared `type` decides two things, not one: how an incoming string is
 * coerced, and **which operators the field may be asked** (`operator-support.ts`
 * holds the table). A field does not accept every operator — the pattern family
 * (`like`/`ilike`/`nilike`) is text-only, because Postgres defines `~~` for text
 * and nothing else.
 */
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
          /**
           * Extra predicate ANDed inside the EXISTS subquery, over the
           * target table's own columns — e.g. a workspace boundary and a
           * soft-delete guard. Without it a relation filter traverses rows
           * the root query itself excludes (a soft-deleted or foreign
           * target still matches `relation.field`). See {@link RelationScope}.
           */
          scope?: RelationScope;
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
          /** Workspace + soft-delete guard. See {@link RelationScope}. */
          scope?: RelationScope;
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
          /**
           * Workspace + soft-delete guard. Because a scope lives on the
           * target table, it can only be applied through the join to
           * `table` — so when it is present the junction-only fast path
           * (filtering on the target FK alone) must yield to the full join.
           * See {@link RelationScope}.
           */
          scope?: RelationScope;
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
          /**
           * Alias used for the self-joined table inside the subquery. Must
           * be unique per occurrence in the filter tree, not per relation:
           * two rules on the same self-relation would otherwise share a
           * correlation name and collide.
           */
          alias: string;
          /**
           * Workspace + soft-delete guard, applied against the aliased
           * self-join (the translator passes the alias). See
           * {@link RelationScope}.
           */
          scope?: RelationScope;
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
    /**
     * Maximum number of elements in a single `in`/`nin` value list.
     * Defaults to 100. Bounds the size of the generated `IN (...)` clause
     * independently of {@link maxNodes} (which counts whole rules, not the
     * elements inside one rule's value list).
     */
    maxInListLength?: number;
}

/** Time units a {@link FilterOperator.WithinLast} window may be measured in. */
export const WithinLastUnit = {
    Minutes: 'minutes',
    Hours: 'hours',
    Days: 'days'
} as const;

/** One of the {@link WithinLastUnit} values. */
export type WithinLastUnit =
    (typeof WithinLastUnit)[keyof typeof WithinLastUnit];

/** The coerced value of a `within_last` leaf. */
export interface WithinLastValue {
    /** How many units back the window reaches. A positive integer. */
    n: number;
    /** The unit `n` is counted in. */
    unit: WithinLastUnit;
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
