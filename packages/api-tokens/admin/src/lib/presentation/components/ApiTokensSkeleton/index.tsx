import { defineMessages, useIntl } from 'react-intl';
import { KeyRound } from 'lucide-react';
import { PageTopBar } from '@ortha-cms/shell-admin';
import {
    Container,
    ContainerHeader,
    Skeleton
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link ApiTokensPageSkeleton}, co-located here. */
const messages = defineMessages({
    title: { id: 'apiTokens.page.title', defaultMessage: 'API tokens' },
    subtitle: {
        id: 'apiTokens.page.subtitle',
        defaultMessage:
            'Bearer tokens for reading content through the external API.'
    }
});

/** Placeholder rows shown while the first token page loads. */
export function ApiTokensSkeleton() {
    return (
        <div className="mt-4 space-y-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback. The chrome —
 * the {@link PageTopBar} and the container header — is **real**, not skeleton:
 * the bar is the page's identity (breadcrumb, icon, and the inline
 * sidebar-reveal trigger), so it must be there from the first paint rather than
 * popping in once the chunk resolves. Only the table body is a skeleton, which
 * is exactly what {@link ApiTokensPage} then swaps for its own `isPending`
 * state — so the chunk boundary is invisible and nothing shifts.
 */
export function ApiTokensPageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <PageTopBar
                icon={KeyRound}
                crumbs={[
                    {
                        key: 'api-tokens',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                <ApiTokensSkeleton />
            </Container>
        </>
    );
}
