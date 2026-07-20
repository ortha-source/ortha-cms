import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { SlidersHorizontal } from 'lucide-react';
import { Container, ContainerHeader } from '@ortha-cms/design-system';
import { PageTopBar } from '@ortha-cms/shell-admin';
import { SettingsTabs } from '../SettingsTabs';
import { PreferencesPage } from '../../pages/PreferencesPage';

/** Intl descriptors for the settings shell, co-located here. */
const messages = defineMessages({
    crumb: { id: 'settings.shell.crumb', defaultMessage: 'Settings' },
    title: { id: 'settings.shell.title', defaultMessage: 'Settings' },
    subtitle: {
        id: 'settings.shell.subtitle',
        defaultMessage: 'Manage your personal account settings.'
    }
});

/** The chrome shared by every settings tab: top bar, header, and the tab rail. */
function SettingsLayout() {
    const intl = useIntl();
    return (
        <>
            <PageTopBar
                icon={SlidersHorizontal}
                crumbs={[
                    {
                        key: 'settings',
                        label: intl.formatMessage(messages.crumb)
                    }
                ]}
            />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                <SettingsTabs />
                <div className="mt-6">
                    <Outlet />
                </div>
            </Container>
        </>
    );
}

/**
 * The `/settings/*` sub-router. A shared {@link SettingsLayout} wraps each tab
 * page; the index redirects to Preferences, and any unknown sub-path falls back
 * there too. Own nested routes (rather than one page) so more account-settings
 * tabs can slot in beside Preferences without touching the plugin factory.
 */
export function SettingsRouter() {
    return (
        <Routes>
            <Route element={<SettingsLayout />}>
                <Route index element={<Navigate to="preferences" replace />} />
                <Route path="preferences" element={<PreferencesPage />} />
                <Route
                    path="*"
                    element={<Navigate to="preferences" replace />}
                />
            </Route>
        </Routes>
    );
}
