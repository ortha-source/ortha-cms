import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Webhook } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    toast
} from '@orthacms/design-system';
import { useWebhookEndpoints } from '../../../application/useWebhookEndpoints';
import { useWebhookEvents } from '../../../application/useWebhookEvents';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import { useCreateWebhook } from '../../../application/useWebhookMutations';
import { WebhooksTable } from '../../components/WebhooksTable';
import { WebhooksEmpty } from '../../components/WebhooksEmpty';
import { WebhooksNoAccess } from '../../components/WebhooksNoAccess';
import { WebhooksSkeleton } from '../../components/WebhooksSkeleton';
import { serverMessageOf } from '../../../infrastructure/serverMessageOf';
import { WebhookFormDialog } from '../../components/WebhookFormDialog';
import { RevealWebhookSecretDialog } from '../../components/RevealWebhookSecretDialog';

const messages = defineMessages({
    title: { id: 'webhooks.page.title', defaultMessage: 'Webhooks' },
    subtitle: {
        id: 'webhooks.page.subtitle',
        defaultMessage: 'Endpoints this CMS notifies when content changes.'
    },
    create: { id: 'webhooks.page.create', defaultMessage: 'New webhook' },
    error: {
        id: 'webhooks.page.error',
        defaultMessage: 'Couldn’t load webhooks. Please try again.'
    },
    retry: { id: 'webhooks.page.retry', defaultMessage: 'Retry' },
    created: {
        id: 'webhooks.page.created',
        defaultMessage: 'Webhook created'
    },
    createFailed: {
        id: 'webhooks.page.createFailed',
        defaultMessage: 'Couldn’t create the webhook. Please try again.'
    },
    count: {
        id: 'webhooks.page.count',
        defaultMessage: '{count, plural, one {# webhook} other {# webhooks}}'
    }
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

    const [createOpen, setCreateOpen] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const { data, isPending, isError, refetch } = useWebhookEndpoints(canRead);
    // Both pickers are only needed once the dialog is open, so neither fetches
    // before then.
    const { data: events } = useWebhookEvents(canManage && createOpen);
    const { data: workspaces } = useWorkspaceOptions(canManage && createOpen);
    const create = useCreateWebhook();

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
                <Container>
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
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                    actions={
                        canManage && (data?.length ?? 0) > 0 ? (
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                {intl.formatMessage(messages.create)}
                            </Button>
                        ) : undefined
                    }
                />

                {isPending ? <WebhooksSkeleton /> : null}

                {/* A failed load gets its own state rather than falling through
                    into "nothing configured yet" — the two look identical and
                    mean opposite things. */}
                {isError ? (
                    <Alert variant="destructive" role="alert" className="mt-4">
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
                            canManage ? () => setCreateOpen(true) : undefined
                        }
                    />
                ) : null}

                {data && data.length > 0 ? (
                    <>
                        <WebhooksTable endpoints={data} />
                        <p className="mt-3 text-sm text-muted-foreground">
                            {intl.formatMessage(messages.count, {
                                count: data.length
                            })}
                        </p>
                    </>
                ) : null}
            </Container>

            <WebhookFormDialog
                open={createOpen}
                onOpenChange={(next) => {
                    setCreateOpen(next);
                    if (!next) setFormError(null);
                }}
                events={events ?? []}
                workspaces={workspaces ?? []}
                pending={create.isPending}
                error={formError}
                onSubmit={(input) => {
                    setFormError(null);
                    create.mutate(input, {
                        onSuccess: ({ secret: minted }) => {
                            setCreateOpen(false);
                            // The secret exists nowhere else from this moment
                            // on, so the reveal opens as the dialog closes.
                            setSecret(minted);
                            toast.success(intl.formatMessage(messages.created));
                        },
                        onError: (error) => {
                            // A refused URL comes back with a message written
                            // for whoever typed it; show that rather than a
                            // generic failure, and keep the dialog open so it
                            // can be corrected in place.
                            setFormError(
                                serverMessageOf(error) ??
                                    intl.formatMessage(messages.createFailed)
                            );
                        }
                    });
                }}
            />

            <RevealWebhookSecretDialog
                secret={secret}
                open={secret !== null}
                onOpenChange={(next) => {
                    if (!next) setSecret(null);
                }}
            />
        </>
    );
}
