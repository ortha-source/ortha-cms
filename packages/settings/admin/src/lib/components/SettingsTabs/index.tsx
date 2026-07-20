import { NavLink } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { TabNav, TabNavLink } from '@ortha-cms/design-system';

/** Intl descriptors for {@link SettingsTabs}, co-located with the component. */
const messages = defineMessages({
    nav: {
        id: 'settings.tabs.nav',
        defaultMessage: 'Account settings'
    },
    preferences: {
        id: 'settings.tabs.preferences',
        defaultMessage: 'Preferences'
    }
});

/**
 * The account-settings tab bar. One tab today (**Preferences**), authored as a
 * route-backed {@link TabNav} so adding a sibling tab later is a one-line
 * change and the router keeps owning the active state.
 */
export function SettingsTabs() {
    const intl = useIntl();
    return (
        <TabNav aria-label={intl.formatMessage(messages.nav)}>
            <TabNavLink asChild>
                <NavLink to="/settings/preferences">
                    {intl.formatMessage(messages.preferences)}
                </NavLink>
            </TabNavLink>
        </TabNav>
    );
}
