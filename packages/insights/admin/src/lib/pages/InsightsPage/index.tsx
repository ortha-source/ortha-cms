import { defineMessages, useIntl } from 'react-intl';
import { BarChart3 } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    Container,
    TopBar,
    TopBarIcon
} from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';

/** Intl descriptors for the insights page, co-located here. */
const messages = defineMessages({
    title: {
        id: 'insights.page.title',
        defaultMessage: 'Insights'
    },
    subtitle: {
        id: 'insights.page.subtitle',
        defaultMessage: 'Activity and analytics for {workspace}.'
    },
    comingSoon: {
        id: 'insights.page.comingSoon',
        defaultMessage: 'Insights are coming soon.'
    }
});

/**
 * Placeholder Insights page, mounted inside the workspace shell at
 * `/workspaces/:id/insights`. Scaffold only — it reads the open workspace from
 * the shell's context and shows a heading; the real dashboards land later.
 */
export function InsightsPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();

    return (
        <>
            <TopBar>
                <TopBarIcon className="bg-warning-soft text-warning-soft-foreground">
                    <BarChart3 />
                </TopBarIcon>
                <Breadcrumb>
                    <BreadcrumbList className="font-medium">
                        <BreadcrumbItem>
                            <BreadcrumbPage className="font-medium">
                                {intl.formatMessage(messages.title)}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </TopBar>
            <Container className="py-8">
                <h1 className="text-2xl font-semibold tracking-[-0.01em]">
                    {intl.formatMessage(messages.title)}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {intl.formatMessage(messages.subtitle, {
                        workspace: workspace.name
                    })}
                </p>
                <p className="mt-6 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.comingSoon)}
                </p>
            </Container>
        </>
    );
}
