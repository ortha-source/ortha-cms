import type { ContentTypeOption } from '../types/contentTypeOption';

/**
 * One row of the content-type picker.
 *
 * `known` is the whole point of this module: a subscription may name a type the
 * running build does not define — one that is about to be added, or one that
 * was removed, or a typo. Such a name must stay selectable and must survive a
 * save, but it should not look like the types the registry vouches for.
 */
export type ContentTypeChoice = {
    /** The machine name — what travels on the wire. */
    value: string;
    /** The registry's label, or the name itself when it has none. */
    label: string;
    /** Whether this build defines the type. */
    known: boolean;
};

/**
 * The picker's options: the registry's types, plus any already-selected name it
 * does not know, appended in selection order.
 *
 * Dropping the unknown ones would be the worst possible behaviour here — the
 * picker would render a subscription it cannot express, and the next save would
 * silently widen the endpoint to types it was deliberately narrowed away from.
 */
export function contentTypeChoices(
    catalogue: readonly ContentTypeOption[],
    selected: readonly string[]
): ContentTypeChoice[] {
    const known = new Set(catalogue.map((type) => type.name));
    return [
        ...catalogue.map((type) => ({
            value: type.name,
            label: type.label,
            known: true
        })),
        ...selected
            .filter((name) => !known.has(name))
            .map((name) => ({ value: name, label: name, known: false }))
    ];
}

/**
 * Reads typed-in machine names.
 *
 * Commas, whitespace and newlines all separate, because this field is pasted
 * into as often as it is typed into, and `article, product` is what a paste
 * looks like. The server accepts any string here — it must, or a type that does
 * not exist yet could never be subscribed to — so this only trims and splits;
 * it does not decide what a valid type name looks like.
 */
export function parseContentTypeNames(raw: string): string[] {
    return raw
        .split(/[\s,]+/)
        .map((name) => name.trim())
        .filter(Boolean);
}

/** Appends `names` to `selected`, keeping order and dropping duplicates. */
export function addContentTypeNames(
    selected: readonly string[],
    names: readonly string[]
): string[] {
    const next = [...selected];
    for (const name of names) {
        if (!next.includes(name)) next.push(name);
    }
    return next;
}
