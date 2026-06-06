import { NavLink, Outlet } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Logo, cn } from '@ortha-cms/design-system';

/** Intl descriptors for {@link AppShell}, co-located with the component. */
const messages = defineMessages({
    home: {
        id: 'shell.nav.home',
        defaultMessage: 'Home'
    },
    primaryNav: {
        id: 'shell.nav.primaryLabel',
        defaultMessage: 'Primary'
    }
});

/**
 * The authenticated app shell: persistent chrome (logo + primary nav) around an
 * `<Outlet/>` where the matched private route renders. The host mounts this as
 * the single guarded layout for every non-public route, so it appears only for
 * signed-in users.
 */
export function AppShell() {
    const intl = useIntl();

    return (
        <div className="flex min-h-svh">
            <aside className="flex w-60 flex-col gap-6 border-r p-4">
                <Logo />
                <nav aria-label={intl.formatMessage(messages.primaryNav)}>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            cn(
                                'block rounded-md px-3 py-2 text-sm font-medium',
                                isActive
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )
                        }
                    >
                        {intl.formatMessage(messages.home)}
                    </NavLink>
                </nav>
            </aside>
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
