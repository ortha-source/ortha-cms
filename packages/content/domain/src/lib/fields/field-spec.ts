/**
 * The **serialized** field-spec shape the pure validator operates on — a plain,
 * JSON-serializable description of one field, no thunks or Drizzle columns. Both
 * runtimes already hold a structurally-compatible object: `content-server`'s
 * `AnyFieldSpec` (its runtime `FieldSpec`) and `content-admin`'s `ContentField`
 * (the wire shape from `GET /content-schema`) each satisfy {@link EntryFieldSpec},
 * so they feed the validator without an adapter.
 */

/** Serialized validation rules for one field (a subset of the wire `validation`). */
export interface FieldValidationRules {
    /** Minimum string length (text/richtext). */
    minLength?: number;
    /** Maximum string length (text/richtext). */
    maxLength?: number;
    /** ECMAScript regex source the value must match (text). */
    pattern?: string;
    /** Minimum numeric value (number/money). */
    min?: number;
    /** Maximum numeric value (number/money). */
    max?: number;
    /** Restrict to whole numbers (number). */
    integer?: boolean;
}

/**
 * The minimal serialized description of one field the validator needs: its
 * type, whether it is required, its validation rules, its allowed `options`
 * (select/multiselect), and — for a relation — whether it is link-managed
 * (`many`/`inverse`). Deliberately structural so both runtimes' richer field
 * objects are assignable to it.
 */
export interface EntryFieldSpec {
    /** Field-type identifier (a `CONTENT_FIELD_TYPE` value). */
    type: string;
    /** Whether an empty value is rejected. */
    required: boolean;
    /** Validation rules; absent/empty means no extra constraints. */
    validation?: FieldValidationRules;
    /** Allowed values — select/multiselect fields only. */
    options?: readonly string[];
    /**
     * Relation config — relation fields only. Only `many`/`inverse` matter to
     * the validator (a link-managed relation is skipped: its links never travel
     * in the `values` bag). `inverse` is typed `unknown` so both runtimes'
     * inverse descriptors (an object) are assignable.
     */
    relation?: {
        many?: boolean;
        inverse?: unknown;
    };
}

/** A field map keyed by field name — the validator's schema input. */
export type EntryFieldSpecMap = Record<string, EntryFieldSpec>;
