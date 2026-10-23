import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { Plus, Webhook } from 'lucide-react';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader
} from '@orthacms/design-system';
import { useWebhookEndpoints } from '../../../application/useWebhookEndpoints';
import { useWebhookEvents } from '../../../application/useWebhookEvents';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import { webhookState } from '../../../domain/webhookHealth';
import {
    WebhooksFilterBar,
    type WebhookFilter
} from '../../components/WebhooksFilterBar';
import { WebhooksTable } from '../../components/WebhooksTable';
import { WebhooksEmpty } from '../../components/WebhooksEmpty';
import { WebhooksNoAccess } from '../../components/WebhooksNoAccess';
import { WebhooksSkeleton } from '../../components/WebhooksSkeleton';

const messages = defineMessages({
    title: { id: 'webhooks.page.title', defaultMessage: 'Webhooks' },
    subtitle: {
        id: 'webhooks.page.description',
        defaultMessage:
            'Send content changes to your services. Each delivery is signed, queued and retried until it lands.'
    },
    noMatch: {
        id: 'webhooks.page.noMatch',
        defaultMessage: 'No webhook matches.'
    },
    create: { id: 'webhooks.page.create', defaultMessage: 'New webhook' },
    error: {
        id: 'webhooks.page.error',
        defaultMessage: 'Couldn’t load webhooks. Please try again.'
    },
    retry: { id: 'webhooks.page.retry', defaultMessage: 'Retry' }
});

/**
 * The global webhooks page (`/webhooks`, in the sidebar's directory group — no
 * workspace context).
 *
 * Everything here is gated on `webhooks:read`, and both keys are
 * administrator-only: an endpoint spans every workspace it names and holds a
 * signing secret, so this is deployment configuration rather than an editorial
 * surface.
 */
export function WebhooksPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));

    const canRead = useHasPermission('webhooks:read');
    const canManage = useHasPermission('webhooks:manage');

    const navigate = useNavigate();
    const { data, isPending, isError, refetch } = useWebhookEndpoints(canRead);
    const { data: events } = useWebhookEvents(canRead);
    const { data: workspaces } = useWorkspaceOptions(canRead);
    const [filter, setFilter] = useState<WebhookFilter>('all');
    const [query, setQuery] = useState('');

    const endpoints = data ?? [];
    const counts: Record<WebhookFilter, number> = {
        all: endpoints.length,
        active: 0,
        paused: 0,
        stopped: 0
    };
    for (const endpoint of endpoints) counts[webhookState(endpoint)] += 1;
    const needle = query.trim().toLowerCase();
    const shown = endpoints.filter(
        (endpoint) =>
            (filter === 'all' || webhookState(endpoint) === filter) &&
            (!needle ||
                endpoint.name.toLowerCase().includes(needle) ||
                endpoint.url.toLowerCase().includes(needle))
    );

    if (!canRead) {
        return (
            <>
                <PageTopBar
                    icon={Webhook}
                    crumbs={[
                        {
                            key: 'webhooks',
                            label: intl.formatMessage(messages.title)
                        }
                    ]}
                />
                <Container width="full">
                    {/* The header stays even without access: the page still
                        needs its `<h1>`, or it has no accessible name and no
                        heading at all (axe `page-has-heading-one`). */}
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                    />
                    <WebhooksNoAccess />
                </Container>
            </>
        );
    }

    return (
        <>
            <PageTopBar
                icon={Webhook}
                crumbs={[
                    {
                        key: 'webhooks',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            {canManage && endpoints.length > 0 ? (
                <PageActionsPortal>
                    <Button size="sm" onClick={() => navigate('/webhooks/new')}>
                        <Plus />
                        {intl.formatMessage(messages.create)}
                    </Button>
                </PageActionsPortal>
            ) : null}
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 py-8 sm:px-10">
                <header className="flex flex-col gap-1.5">
                    <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.012em]">
                        {intl.formatMessage(messages.title)}
                    </h1>
                    <p className="max-w-[640px] text-[13px] text-muted-foreground">
                        {intl.formatMessage(messages.subtitle)}
                    </p>
                </header>

                {isPending ? <WebhooksSkeleton /> : null}

                {/* A failed load gets its own state rather than falling through
                    into "nothing configured yet" — the two look identical and
                    mean opposite things. */}
                {isError ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription className="flex items-center justify-between gap-4">
                            {intl.formatMessage(messages.error)}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {data && data.length === 0 ? (
                    <WebhooksEmpty
                        onCreate={
                            canManage
                                ? () => navigate('/webhooks/new')
                                : undefined
                        }
                    />
                ) : null}

                {data && data.length > 0 ? (
                    <>
                        <WebhooksFilterBar
                            filter={filter}
                            onFilterChange={setFilter}
                            counts={counts}
                            query={query}
                            onQueryChange={setQuery}
                        />
                        {shown.length > 0 ? (
                            <WebhooksTable
                                endpoints={shown}
                                events={events ?? []}
                                workspaces={workspaces ?? []}
                            />
                        ) : (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {intl.formatMessage(messages.noMatch)}
                            </p>
                        )}
                    </>
                ) : null}
            </div>
        </>
    );
}
