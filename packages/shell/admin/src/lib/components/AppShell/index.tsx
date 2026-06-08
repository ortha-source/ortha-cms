import { Outlet } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Logo,
    Separator,
    Navbar,
    NavbarBrand,
    NavbarNav,
    NavbarSpacer
} from '@ortha-cms/design-system';
import { NAV_ITEM_SLOT } from '../../slots/navItemSlot';
import { NavbarNavButton } from '../NavbarNavButton';

/** Intl descriptors for {@link AppShell}, co-located with the component. */
const messages = defineMessages({
    primaryNav: {
        id: 'shell.nav.primaryLabel',
        defaultMessage: 'Primary'
    }
});

/**
 * The authenticated app shell: a sticky top toolbar (logo + slot-driven nav)
 * over an `<Outlet/>` where the matched private route renders. The host mounts
 * this as the single guarded layout for every non-public route, so it appears
 * only for signed-in users. Nav entries come from {@link NAV_ITEM_SLOT}, sorted
 * by `order`, so any plugin can contribute without touching the shell.
 */
export function AppShell() {
    const intl = useIntl();
    const navItems = NAV_ITEM_SLOT.getItems()
        .slice()
        .sort((a, b) => a.order - b.order);

    return (
        <div className="flex min-h-svh flex-col">
            <Navbar>
                <NavbarBrand>
                    <Logo showLabel={false} />
                </NavbarBrand>
                <Separator
                    orientation="vertical"
                    className="mx-1 h-6 bg-zinc-700"
                />
                <NavbarNav aria-label={intl.formatMessage(messages.primaryNav)}>
                    {navItems.map((item) => (
                        <NavbarNavButton key={item.to} item={item} />
                    ))}
                </NavbarNav>
                <NavbarSpacer />
            </Navbar>
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
