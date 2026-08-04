import { createContext, useContext, type ReactNode } from 'react';

/** Which field, if any, has taken over the editor's work area. */
export type ExpandedFieldState = {
    /** The expanded field's machine name, or `null` when the form is showing. */
    name: string | null;
    /** Expand a field (or pass `null` to return to the form). */
    setName: (name: string | null) => void;
};

/**
 * Nothing expanded, and no way to expand. The default so `EntryFieldInput`
 * works outside an editor (a preview, a test) instead of throwing — a control
 * that can't expand there simply never does.
 */
const CLOSED: ExpandedFieldState = { name: null, setName: () => undefined };

const ExpandedFieldContext = createContext<ExpandedFieldState>(CLOSED);

/**
 * Carries the **expanded field** down to `EntryFieldInput`, which is the one
 * place that knows a field's slot item and can hand a control its
 * `expanded` / `setExpanded`.
 *
 * A context rather than props because the path runs `EntryEditor` →
 * `EntryFieldSections` → `FieldGroup` → `EntryFieldInput`, and those two middle
 * components have no interest in the state — threading it through would make
 * them care about a feature neither renders.
 *
 * The state lives in `EntryEditor` (not here) because that is the component
 * that has to *act* on it: it swaps the tab strip for the expanded view.
 */
export function ExpandedFieldProvider({
    value,
    children
}: {
    value: ExpandedFieldState;
    children: ReactNode;
}) {
    return (
        <ExpandedFieldContext.Provider value={value}>
            {children}
        </ExpandedFieldContext.Provider>
    );
}

/** The current expanded-field state. See {@link ExpandedFieldProvider}. */
export function useExpandedField(): ExpandedFieldState {
    return useContext(ExpandedFieldContext);
}
