import { defineMessages, useIntl } from 'react-intl';
import { Image } from 'lucide-react';
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

/** Intl descriptors for the media library page, co-located here. */
const messages = defineMessages({
    title: {
        id: 'media.library.title',
        defaultMessage: 'Media Library'
    },
    subtitle: {
        id: 'media.library.subtitle',
        defaultMessage: 'Browse and manage media in {workspace}.'
    },
    comingSoon: {
        id: 'media.library.comingSoon',
        defaultMessage: 'The media library is coming soon.'
    }
});

/**
 * Placeholder Media Library page, mounted inside the workspace shell at
 * `/workspaces/:id/media`. Scaffold only — it reads the open workspace from the
 * shell's context and shows a heading; the real asset browser lands later.
 */
export function MediaLibraryPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();

    return (
        <>
            <TopBar>
                <TopBarIcon className="bg-teal-soft text-teal-soft-foreground">
                    <Image />
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
