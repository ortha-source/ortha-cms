import { createContext, useContext, type ReactNode } from 'react';

/**
 * Editable by default. The default so `EntryFieldInput` and the relation
 * controls work outside an editor (a preview, a test) instead of throwing —
 * and so a mount site that forgets the provider fails **open** on the UI while
 * the server's `@RequirePermissions` still refuses the write. The permission
 * check that matters is the server's; this only decides what the form offers.
 */
const EDITABLE = false;

const EntryReadOnlyContext = createContext<boolean>(EDITABLE);

/**
 * Carries the editor's **read-only** state down to every control that can write
 * to the record — the field inputs, the relation rows, and (through the slot
 * contexts) contributed controls and tabs.
 *
 * A context rather than props because the path runs `EntryEditor` →
 * `EntryFieldSections` → `FieldGroup` → `EntryFieldInput` (and
 * `RelationFieldSection` → `RelationField`/`RelationFieldLive` →
 * `RelationItemRow`), and the middle components have no interest in the state.
 * The same reasoning as `ExpandedFieldProvider`, which takes the same path.
 *
 * The value is decided in `EntryEditor` from `content:create` (a create form) or
 * `content:update` (an existing record) — a user without it may read the record
 * but not change it, so the form renders as a **preview**: values stay legible
 * and selectable, nothing accepts input, and every add/remove/reorder control is
 * gone rather than disabled, since there is no state in which they'd light up.
 */
export function EntryReadOnlyProvider({
    value,
    children
}: {
    value: boolean;
    children: ReactNode;
}) {
    return (
        <EntryReadOnlyContext.Provider value={value}>
            {children}
        </EntryReadOnlyContext.Provider>
    );
}

/**
 * Whether the open entry editor is a read-only preview. See
 * {@link EntryReadOnlyProvider}.
 */
export function useEntryReadOnly(): boolean {
    return useContext(EntryReadOnlyContext);
}
