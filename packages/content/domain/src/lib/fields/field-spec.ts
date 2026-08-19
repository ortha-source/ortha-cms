/**
 * The **serialized** field-spec shape the pure validator operates on — a plain,
 * JSON-serializable description of one field, no thunks or Drizzle columns. Both
 * runtimes already hold a structurally-compatible object: `content-server`'s
 * `AnyFieldSpec` (its runtime `FieldSpec`) and `content-admin`'s `ContentField`
 * (the wire shape from `GET /content-schema`) each satisfy {@link EntryFieldSpec},
 * so they feed the validator without an adapter.
 */

/**
 * How strictly a `richtext` body's **structure** is checked — heading order,
 * table headers, link text, language markers (see `inspectRichText`).
 *
 * `'on'` (the default) fails the field on a structural **error**; warnings stay
 * advisory either way, so a heuristic never blocks a save. `'off'` is the
 * deliberate opt-out for a body that is not a document — a hand-maintained
 * fragment, an email template — where the rules would be measuring the wrong
 * thing.
 */
export type RichTextStructureMode = 'on' | 'off';

/** Serialized validation rules for one field (a subset of the wire `validation`). */
export interface FieldValidationRules {
    /**
     * Minimum length (text/richtext). On a `richtext` field this counts the
     * body's **text**, not its markup — see `richTextPlainText`.
     */
    minLength?: number;
    /**
     * Maximum length (text/richtext). On a `richtext` field this counts the
     * body's **text**, not its markup: bolding a word used to cost an author
     * `<strong></strong>` out of their budget.
     */
    maxLength?: number;
    /**
     * ECMAScript regex source the value must match (text/richtext). On a
     * `richtext` field it is matched against the body's text, for the same
     * reason the lengths are counted there.
     */
    pattern?: string;
    /** Structural checking of a `richtext` body; defaults to `'on'`. */
    structure?: RichTextStructureMode;
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
    /**
     * BCP-47 tag naming the language this field's content is written in, when
     * it is not the entry's own — the *field-level* half of language of parts
     * (WCAG 3.1.2). A `richtext` body additionally carries a per-node `lang`,
     * so a quoted passage inside an otherwise-English body is expressible; this
     * is for the case where the whole field is in another language (an
     * `originalTitle`, a `motto`).
     *
     * Checked for well-formedness, not against a registry — see
     * `isWellFormedLanguageTag`.
     */
    lang?: string;
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
    /**
     * Media fields only: `true` when the field holds an **ordered list** of
     * asset ids (validated as a `uuid[]`) rather than a single id. The validator
     * only shape-checks the ids here — an asset's existence and its kind/MIME
     * against the field's `accept` restriction are enforced server-side, where
     * the media table can be read.
     */
    multiple?: boolean;
}

/** A field map keyed by field name — the validator's schema input. */
export type EntryFieldSpecMap = Record<string, EntryFieldSpec>;
