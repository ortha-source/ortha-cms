import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { KeyRound, Plus } from 'lucide-react';
import { PageTopBar } from '@ortha-cms/shell-admin';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    toast
} from '@ortha-cms/design-system';
import { useApiTokens, DEFAULT_PAGE_SIZE } from '../../../application/useApiTokens';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import {
    useCreateApiToken,
    useRevokeApiToken
} from '../../../application/useApiTokensMutation';
import { ApiTokensTable } from '../../components/ApiTokensTable';
import { ApiTokensSkeleton } from '../../components/ApiTokensSkeleton';
import { ApiTokensEmpty } from '../../components/ApiTokensEmpty';
import { ApiTokensNoAccess } from '../../components/ApiTokensNoAccess';
import { CreateApiTokenDialog } from '../../components/CreateApiTokenDialog';
import { RevealSecretDialog } from '../../components/RevealSecretDialog';
import type { CreateApiTokenInput } from '../../../infrastructure/apiTokenGateway';

const messages = defineMessages({
    title: { id: 'apiTokens.page.title', defaultMessage: 'API tokens' },
    subtitle: {
        id: 'apiTokens.page.subtitle',
        defaultMessage:
            'Bearer tokens for reading content through the external API.'
    },
    create: { id: 'apiTokens.page.create', defaultMessage: 'New token' },
    error: {
        id: 'apiTokens.page.error',
        defaultMessage: 'Couldn’t load API tokens. Please try again.'
    },
    retry: { id: 'apiTokens.page.retry', defaultMessage: 'Retry' },
    createError: {
        id: 'apiTokens.page.createError',
        defaultMessage: 'Couldn’t create the token. Please try again.'
    },
    revokeError: {
        id: 'apiTokens.page.revokeError',
        defaultMessage: 'Couldn’t revoke the token. Please try again.'
    },
    prev: { id: 'apiTokens.page.prev', defaultMessage: 'Previous' },
    next: { id: 'apiTokens.page.next', defaultMessage: 'Next' },
    pageOf: {
        id: 'apiTokens.page.pageOf',
        defaultMessage: 'Page {page} of {pageCount}'
    }
});

/**
 * The global "API tokens" management page (rendered at `/api-tokens` in the main
 * admin sidebar's directory group — no workspace context). Lists tokens, creates
 * them (choosing the target workspace in the dialog), reveals the plaintext once
 * on creation, and revokes them. Gated on `tokens:read`; the create/revoke
 * controls additionally require `tokens:create`/`tokens:delete`.
 */
export function ApiTokensPage() {
    const intl = useIntl();
    const canRead = useHasPermission('tokens:read');
    const canCreate = useHasPermission('tokens:create');
    const canRevoke = useHasPermission('tokens:delete');

    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);

    const { data, isPending, isError, refetch } = useApiTokens(
        { page, pageSize: DEFAULT_PAGE_SIZE },
        canRead
    );
    // Workspace names for the table's Workspace column; the create dialog reuses
    // the same cached query.
    const { data: workspaces = [] } = useWorkspaceOptions(canRead);
    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
        [workspaces]
    );

    const createToken = useCreateApiToken();
    const revokeToken = useRevokeApiToken();

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // Pull `page` back after a revoke empties the last page.
    useEffect(() => {
        if (data && page > pageCount) {
            setPage(pageCount);
        }
    }, [data, page, pageCount]);

    if (!canRead) {
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
                    />
                    <ApiTokensNoAccess />
                </Container>
            </>
        );
    }

    const tokens = data?.items ?? [];

    const submitCreate = (input: CreateApiTokenInput) => {
        createToken.mutate(input, {
            onSuccess: (created) => {
                setCreateOpen(false);
                setSecret(created.secret);
            },
            onError: () =>
                toast.error(intl.formatMessage(messages.createError))
        });
    };

    const revoke = (id: string) => {
        revokeToken.mutate(id, {
            onError: () =>
                toast.error(intl.formatMessage(messages.revokeError))
        });
    };

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
                    actions={
                        canCreate ? (
                            <Button onClick={() => setCreateOpen(true)}>
                                <Plus />
                                {intl.formatMessage(messages.create)}
                            </Button>
                        ) : undefined
                    }
                />

                {isPending ? (
                    <ApiTokensSkeleton />
                ) : isError ? (
                    <Alert variant="destructive" role="alert" className="mt-4">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{intl.formatMessage(messages.error)}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shadow-none"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : tokens.length === 0 ? (
                    <ApiTokensEmpty
                        onCreate={
                            canCreate ? () => setCreateOpen(true) : undefined
                        }
                    />
                ) : (
                    <>
                        <ApiTokensTable
                            tokens={tokens}
                            canRevoke={canRevoke}
                            onRevoke={revoke}
                            revokingId={
                                revokeToken.isPending
                                    ? (revokeToken.variables ?? null)
                                    : null
                            }
                            resolveWorkspaceName={(id) =>
                                workspaceNames.get(id) ?? id
                            }
                        />
                        {pageCount > 1 ? (
                            <div className="mt-4 flex items-center justify-end gap-3">
                                <span className="text-sm text-muted-foreground">
                                    {intl.formatMessage(messages.pageOf, {
                                        page,
                                        pageCount
                                    })}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                >
                                    {intl.formatMessage(messages.prev)}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pageCount}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.min(pageCount, current + 1)
                                        )
                                    }
                                >
                                    {intl.formatMessage(messages.next)}
                                </Button>
                            </div>
                        ) : null}
                    </>
                )}
            </Container>

            <CreateApiTokenDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSubmit={submitCreate}
                submitting={createToken.isPending}
            />
            <RevealSecretDialog
                secret={secret}
                open={secret !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSecret(null);
                    }
                }}
            />
        </>
    );
}
