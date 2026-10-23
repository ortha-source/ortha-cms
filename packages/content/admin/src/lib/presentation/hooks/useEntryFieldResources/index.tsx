import { createContext, useContext, type ReactNode } from 'react';
import type { ContentField, MediaRef } from '../../../domain/types/contentType';

/**
 * What a field's control may need from the editor beyond its own value — the
 * things the Relations and Media **tabs** used to be handed, now that those
 * fields render inline in the one form.
 */
export type EntryFieldResources = {
    /**
     * Whether the open type keeps its records in several locales. On such a
     * type a field the schema does not mark `localized` is **shared**: editing
     * it changes every locale, which the field says beside its label.
     */
    i18n: boolean;
    /** The saved entry's media fields, resolved to display refs by field name. */
    mediaRefs: Record<string, MediaRef[]>;
    /** Whether those refs are still loading (a tile waits rather than guesses). */
    mediaRefsPending: boolean;
    /**
     * The presave contributions' opaque handles, keyed by item id — a
     * contributed control reads only its own key (the media plugin's staged
     * uploads).
     */
    presave: Record<string, unknown>;
    /**
     * Draws a field the editor renders itself rather than through
     * `EntryFieldInput` — a relation, whose links are staged on the editor.
     * `null` means "not mine": the field takes the ordinary input.
     */
    renderField?: (field: ContentField) => ReactNode | null;
};

/**
 * Outside an editor (a preview, a test) a field has no locales, no media and
 * no staging — and every control renders the way it always did.
 */
const NONE: EntryFieldResources = {
    i18n: false,
    mediaRefs: {},
    mediaRefsPending: false,
    presave: {}
};

const EntryFieldResourcesContext = createContext<EntryFieldResources>(NONE);

/**
 * Carries the editor's per-field resources down to `FieldStack` and
 * `EntryFieldInput`.
 *
 * A context for the reason `useExpandedField` is one: the path runs through
 * `EntryFieldSections` and `FieldSection`, neither of which has any interest
 * in media refs or staged links.
 */
export function EntryFieldResourcesProvider({
    value,
    children
}: {
    value: EntryFieldResources;
    children: ReactNode;
}) {
    return (
        <EntryFieldResourcesContext.Provider value={value}>
            {children}
        </EntryFieldResourcesContext.Provider>
    );
}

/** The open editor's field resources (inert defaults outside one). */
export function useEntryFieldResources(): EntryFieldResources {
    return useContext(EntryFieldResourcesContext);
}
