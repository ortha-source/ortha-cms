/**
 * Field-type identifiers and the shared empty-value test — the small, stable
 * vocabulary the pure validator switches on. These string values mirror
 * `content-server`'s `CONTENT_FIELD_TYPE` and `isEmptyFieldValue` one-for-one
 * (they are the JSON-serialized wire identifiers a `SerializedField.type`
 * carries), kept here so the kernel stays dependency-free — it imports nothing
 * from `content-server`, so `content-server` may depend on it without a cycle.
 */

/** Built-in field-type identifiers (the wire `type` of a serialized field). */
export const CONTENT_FIELD_TYPE = {
    Text: 'text',
    RichText: 'richtext',
    Number: 'number',
    Money: 'money',
    Boolean: 'boolean',
    Date: 'date',
    Datetime: 'datetime',
    Select: 'select',
    Multiselect: 'multiselect',
    Json: 'json',
    Relation: 'relation',
    Media: 'media'
} as const;

/** Built-in field-type identifiers. */
export type FieldType =
    (typeof CONTENT_FIELD_TYPE)[keyof typeof CONTENT_FIELD_TYPE];

/**
 * The canonical "no value" test for a field value — null/undefined, a blank
 * (whitespace-only) string, or an empty array. The single definition both
 * runtimes share (validation skips an empty value or trips `required`; the
 * server's row mappers collapse it to `null`). One authority so the runtimes
 * can't drift.
 */
export function isEmptyFieldValue(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
    );
}

/** Minimal structural view of `Intl.Segmenter`, so no `lib` bump is needed. */
interface GraphemeSegmenter {
    segment(input: string): Iterable<unknown>;
}

let graphemeSegmenter: GraphemeSegmenter | undefined;
let graphemeSegmenterResolved = false;

/** Lazily builds the grapheme segmenter once, if the runtime has `Intl.Segmenter`. */
function getGraphemeSegmenter(): GraphemeSegmenter | undefined {
    if (!graphemeSegmenterResolved) {
        graphemeSegmenterResolved = true;
        const ctor = (
            globalThis as {
                Intl?: {
                    Segmenter?: new (
                        locales?: undefined,
                        options?: { granularity: 'grapheme' }
                    ) => GraphemeSegmenter;
                };
            }
        ).Intl?.Segmenter;
        if (ctor) {
            graphemeSegmenter = new ctor(undefined, {
                granularity: 'grapheme'
            });
        }
    }
    return graphemeSegmenter;
}

/**
 * Length of a text value in **user-perceived characters** — the unit a
 * `minLength`/`maxLength` rule and its `must be at most N characters` message
 * promise the author.
 *
 * `String.length` counts UTF-16 code units, so `'👍'` costs 2, a decomposed
 * `'é'` costs 2 and `'👨‍👩‍👧‍👦'` costs 11. Grapheme clusters (via `Intl.Segmenter`,
 * a platform global — no dependency) count each of those as 1. Runtimes without
 * `Intl.Segmenter` fall back to code points, which is still strictly closer to
 * the promise than code units are.
 *
 * Both runtimes must agree, so this is defined once, here, next to
 * {@link isEmptyFieldValue}.
 */
export function countCharacters(value: string): number {
    const segmenter = getGraphemeSegmenter();
    return segmenter
        ? Array.from(segmenter.segment(value)).length
        : Array.from(value).length;
}
