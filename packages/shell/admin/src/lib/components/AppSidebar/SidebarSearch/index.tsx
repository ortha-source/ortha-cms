import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';

/** Intl descriptors for {@link SidebarSearch}, co-located here. */
const messages = defineMessages({
    search: {
        id: 'shell.sidebar.search',
        defaultMessage: 'Search'
    }
});

/**
 * The sidebar's search affordance: a full-width trigger styled like a search
 * field, with a ⌘K hint. It mirrors the design in both the global and
 * per-workspace contexts.
 *
 * NOTE: the global command palette is not wired yet — this is the trigger UI
 * pending that work; clicking it is currently a no-op. Kept here so the sidebar
 * matches the intended layout and the palette can hang off a single component.
 */
export function SidebarSearch() {
    const intl = useIntl();
    const label = intl.formatMessage(messages.search);

    return (
        <button
            type="button"
            aria-label={label}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">{label}</span>
            <kbd className="pointer-events-none rounded border border-sidebar-border bg-sidebar px-1.5 font-mono text-xs">
                ⌘K
            </kbd>
        </button>
    );
}
