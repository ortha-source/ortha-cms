import { createContext, useContext, type ReactNode } from 'react';
import type { EntrySlotContext } from '../../slots/contentSlots';

const Context = createContext<EntrySlotContext | null>(null);

/**
 * Provides the entry editor's {@link EntrySlotContext} to slot consumers
 * nested anywhere inside it (the sidebar widget slot, the relation picker's
 * entry-params contributions) — assembled once by `ContentEntryView`, so deep
 * components don't need the context threaded through every layer of props.
 */
export function EntrySlotContextProvider({
    value,
    children
}: {
    value: EntrySlotContext | null;
    children: ReactNode;
}) {
    return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * The surrounding entry editor's slot context, or `null` outside an editor.
 */
export function useEntrySlotContext(): EntrySlotContext | null {
    return useContext(Context);
}
