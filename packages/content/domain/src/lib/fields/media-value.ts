/**
 * The value a `media` field holds.
 *
 * It used to be **exactly a UUID**, or an array of them — a shape with nowhere
 * to put a text alternative. So the model could not express alt text at all,
 * could not express "decorative" as distinct from "missing" (which is the
 * distinction WCAG 1.1.1 turns on), and a validator that enforced `required` on
 * the *id* while having no opinion on the *description* reported an entry as
 * valid and publishable with an image nobody could read (`ORT-83`).
 *
 * Alt text is per **usage**, not per **asset**: the same logo is "Acme logo" in
 * a header and decorative in a footer strip. An asset-level default on the media
 * row cannot express that override, which is why this lives on the field's value
 * rather than only in the media library.
 */

/**
 * Cap on a text alternative, in characters.
 *
 * Alt text is a *replacement* for the image, not a description of it: a
 * paragraph in an `alt` is read as one unbroken run with no way to skim or
 * pause, which is worse for the reader it is meant to serve. Long-form
 * description belongs in a caption or the body. The number matches the copilot's
 * `media_propose_alt_text` schema, so the two write paths agree.
 */
export const MEDIA_ALT_MAX_LENGTH = 1000;

/** One attached asset, with the text alternative for *this* usage. */
export interface MediaValueRef {
    /** The media asset's id. */
    id: string;
    /**
     * The text alternative for this usage. Absent means **not supplied** —
     * which is not the same as {@link decorative}, and is what the publish gate
     * refuses on a required field.
     */
    alt?: string;
    /**
     * Marks the asset as purely presentational here, so it should publish with
     * an empty `alt` and be skipped by a screen reader.
     *
     * A deliberate answer, not an omission. An empty `alt` string cannot carry
     * this meaning on its own — an author who left the box blank and an author
     * who decided the image says nothing produce the same bytes — so it is its
     * own flag.
     */
    decorative?: boolean;
}

/**
 * What a `media` field accepts on the wire: the full shape, or a bare asset id.
 *
 * The bare id is the **legacy** form. Every media value written before
 * `ORT-83` is one, and rejecting them would make existing entries unreadable
 * rather than merely un-publishable — so they are still accepted, normalized to
 * `{ id }`, and treated as "no alternative supplied", which is exactly what they
 * are.
 */
export type MediaValueInput = string | MediaValueRef;

/** Whether `value` is a {@link MediaValueRef} rather than a bare id. */
export function isMediaValueRef(value: unknown): value is MediaValueRef {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        typeof (value as { id?: unknown }).id === 'string'
    );
}

/**
 * Normalizes either accepted form to a {@link MediaValueRef}, or `null` when it
 * is neither. Every reader should go through this rather than branching on the
 * shape itself, so the legacy form stays confined to this module.
 */
export function toMediaValueRef(value: unknown): MediaValueRef | null {
    if (typeof value === 'string') return { id: value };
    if (isMediaValueRef(value)) return value;
    return null;
}

/** The asset ids in a single or `multiple` media value, in order. */
export function mediaValueIds(value: unknown): string[] {
    const many = Array.isArray(value) ? value : [value];
    return many
        .map(toMediaValueRef)
        .filter((ref): ref is MediaValueRef => ref !== null)
        .map((ref) => ref.id);
}

/**
 * Whether this usage has answered the text-alternative question — either with
 * words, or by saying there are none to give.
 *
 * A blank `alt` is **not** an answer: it is indistinguishable from an untouched
 * field, which is the ambiguity `decorative` exists to remove.
 */
export function hasTextAlternative(ref: MediaValueRef): boolean {
    if (ref.decorative === true) return true;
    return typeof ref.alt === 'string' && ref.alt.trim() !== '';
}
