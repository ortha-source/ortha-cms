import type { ContentTypeOption } from '../types/contentTypeOption';
import type { WorkspaceOption } from '../types/workspaceOption';

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

/** The endpoint's workspace filter, as the form holds it. */
export type WorkspaceSelection = {
    /** Every workspace, including ones created later. */
    allWorkspaces: boolean;
    /** The chosen workspace ids, when `allWorkspaces` is off. */
    workspaceIds: readonly string[];
};

/**
 * The types worth offering for a given workspace filter.
 *
 * A delivery needs both halves of the filter to match — the event's workspace
 * **and** its content type — so a type none of the chosen workspaces was granted
 * can never fire for this endpoint. Offering it is offering a filter that
 * guarantees silence, which is the mistake the editor exists to prevent.
 *
 * Two cases deliberately fall back to the whole registry rather than to
 * nothing:
 *
 * - **`allWorkspaces`** — the endpoint covers workspaces that do not exist yet,
 *   and those may be granted anything.
 * - **no workspace chosen at all** — there is nothing to narrow by. The caller
 *   decides whether to show the picker at all in that state; narrowing to an
 *   empty list here would be a guess dressed up as a rule.
 */
export function grantedContentTypes(
    catalogue: readonly ContentTypeOption[],
    workspaces: readonly WorkspaceOption[],
    { allWorkspaces, workspaceIds }: WorkspaceSelection
): ContentTypeOption[] {
    if (allWorkspaces || workspaceIds.length === 0) return [...catalogue];

    const granted = new Set(
        workspaces
            .filter((workspace) => workspaceIds.includes(workspace.id))
            .flatMap((workspace) => workspace.contentTypes)
    );
    return catalogue.filter((type) => granted.has(type.name));
}
