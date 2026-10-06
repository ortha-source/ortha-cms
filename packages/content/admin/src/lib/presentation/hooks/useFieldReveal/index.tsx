import { createContext, useContext, type ReactNode } from 'react';

/**
 * A request to unfold one of the General tab's sections, so a field inside it
 * can be scrolled to and focused.
 *
 * `seq` makes a repeat request for the same section a new value: an author who
 * folds the section again and jumps back to it must see it open again, and an
 * equal object would not re-run the effect that opens it.
 */
export type FieldRevealRequest = { section: string; seq: number } | null;

const FieldRevealContext = createContext<FieldRevealRequest>(null);

/**
 * Carries the outline's last reveal request down to `FieldSection`.
 *
 * A section owns its open state (`useSectionOpen`, remembered per type), and
 * the outline that wants it open is a sibling far up the tree — so the request
 * travels by context, the way `useExpandedField` reaches `EntryFieldInput`,
 * rather than threading a prop through `EntryFieldSections`, which has no
 * interest in it.
 */
export function FieldRevealProvider({
    value,
    children
}: {
    value: FieldRevealRequest;
    children: ReactNode;
}) {
    return (
        <FieldRevealContext.Provider value={value}>
            {children}
        </FieldRevealContext.Provider>
    );
}

/** The latest reveal request, or `null` outside an editor or before any. */
export function useFieldRevealRequest(): FieldRevealRequest {
    return useContext(FieldRevealContext);
}
