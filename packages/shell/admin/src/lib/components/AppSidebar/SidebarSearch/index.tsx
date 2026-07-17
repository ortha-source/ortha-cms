import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList,
    Kbd
} from '@ortha-cms/design-system';
import { byOrder } from '@ortha-cms/utils-admin';
import { SIDEBAR_NAV_SLOT } from '../../../slots/sidebarSlots';
import { COMMAND_SLOT } from '../../../slots/commandSlots';
import { SidebarCommandItem } from './SidebarCommandItem';

/** Intl descriptors for {@link SidebarSearch}, co-located here. */
const messages = defineMessages({
    search: {
        id: 'shell.sidebar.search',
        defaultMessage: 'Search'
    },
    title: {
        id: 'shell.search.title',
        defaultMessage: 'Search'
    },
    description: {
        id: 'shell.search.description',
        defaultMessage: 'Jump to a section.'
    },
    placeholder: {
        id: 'shell.search.placeholder',
        defaultMessage: 'Search or jump to…'
    },
    empty: {
        id: 'shell.search.empty',
        defaultMessage: 'No results.'
    },
    goTo: {
        id: 'shell.search.goTo',
        defaultMessage: 'Go to'
    },
    footerNavigate: {
        id: 'shell.search.footerNavigate',
        defaultMessage: 'to navigate'
    },
    footerOpen: {
        id: 'shell.search.footerOpen',
        defaultMessage: 'to open'
    },
    footerClose: {
        id: 'shell.search.footerClose',
        defaultMessage: 'to close'
    }
});

/**
 * The sidebar's search affordance and the ⌘K command palette behind it. The
 * trigger is styled like a search field; clicking it — or pressing ⌘K / Ctrl+K
 * — opens a `CommandDialog` whose suggestions are the primary-nav destinations
 * ({@link SIDEBAR_NAV_SLOT}, permission-gated), so you can filter and jump to
 * any section from the keyboard.
 *
 * Rendered only in the global sidebar (the per-workspace sidebar has its own
 * content ⌘K palette), so the shortcut never double-binds.
 */
export function SidebarSearch() {
    const intl = useIntl();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    // ⌘K / Ctrl+K toggles the palette.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setOpen((value) => !value);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const items = byOrder(SIDEBAR_NAV_SLOT.getItems());
    const sections = byOrder(COMMAND_SLOT.getItems());

    const go = (to: string) => {
        setOpen(false);
        navigate(to);
    };
    const close = () => setOpen(false);

    const label = intl.formatMessage(messages.search);

    return (
        <>
            <button
                type="button"
                aria-label={label}
                onClick={() => setOpen(true)}
                className="flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
                <Search className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                <kbd className="pointer-events-none rounded border border-sidebar-border bg-sidebar px-1.5 font-mono text-xs">
                    ⌘K
                </kbd>
            </button>

            <CommandDialog
                open={open}
                onOpenChange={setOpen}
                title={intl.formatMessage(messages.title)}
                description={intl.formatMessage(messages.description)}
            >
                <CommandInput
                    placeholder={intl.formatMessage(messages.placeholder)}
                />
                <CommandList>
                    <CommandEmpty>
                        {intl.formatMessage(messages.empty)}
                    </CommandEmpty>
                    <CommandGroup heading={intl.formatMessage(messages.goTo)}>
                        {items.map((item) => (
                            <SidebarCommandItem
                                key={item.to}
                                item={item}
                                onNavigate={go}
                            />
                        ))}
                    </CommandGroup>
                    {sections.map(({ id, Component }) => (
                        <Component key={id} close={close} />
                    ))}
                </CommandList>
                <div className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd>
                        {intl.formatMessage(messages.footerNavigate)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>↵</Kbd>
                        {intl.formatMessage(messages.footerOpen)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>esc</Kbd>
                        {intl.formatMessage(messages.footerClose)}
                    </span>
                </div>
            </CommandDialog>
        </>
    );
}
