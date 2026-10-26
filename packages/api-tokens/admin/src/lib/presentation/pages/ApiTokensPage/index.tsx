import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { KeyRound, Plus } from 'lucide-react';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    SearchToolbar,
    toast
} from '@orthacms/design-system';
import { useDocumentTitle, useTableUrlState } from '@orthacms/utils-admin';
import {
    useApiTokens,
    DEFAULT_PAGE_SIZE
} from '../../../application/useApiTokens';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import {
    useCreateApiToken,
    useRevokeApiToken
} from '../../../application/useApiTokensMutation';
import { daysUntil } from '../../../domain/apiTokenExpiry';
import type {
    ApiToken,
    ApiTokenStatus,
    ApiTokenSummary,
    CreatedApiToken
} from '../../../domain/types/apiToken';
import type { ApiTokensListParams } from '../../../infrastructure/apiTokensKeys';
import type { CreateApiTokenInput } from '../../../infrastructure/apiTokenGateway';
import { ApiTokensTable } from '../../components/ApiTokensTable';
import { ApiTokensSkeleton } from '../../components/ApiTokensSkeleton';
import { ApiTokensEmpty } from '../../components/ApiTokensEmpty';
import { ApiTokensNoAccess } from '../../components/ApiTokensNoAccess';
import { ApiTokensNoMatch } from '../../components/ApiTokensNoMatch';
import {
    ApiTokensStatusChips,
    STATUS_CHIPS
} from '../../components/ApiTokensStatusChips';
import { CreateApiTokenDialog } from '../../components/CreateApiTokenDialog';
import { RevealSecretDialog } from '../../components/RevealSecretDialog';
import { RevokeApiTokenDialog } from '../../components/RevokeApiTokenDialog';

const messages = defineMessages({
    title: { id: 'apiTokens.page.title', defaultMessage: 'API tokens' },
    subtitle: {
        id: 'apiTokens.page.subtitle',
        defaultMessage: 'Bearer tokens for the content API'
    },
    subtitleActive: {
        id: 'apiTokens.page.subtitleActive',
        defaultMessage: '{active, number} active'
    },
    subtitleSoon: {
        id: 'apiTokens.page.subtitleSoon',
        defaultMessage:
            '{active, number} active, {soon, plural, one {# expires} other {# expire, the first}} {days, plural, =0 {today} one {in # day} other {in # days}}'
    },
    create: { id: 'apiTokens.page.create', defaultMessage: 'New token' },
    searchLabel: {
        id: 'apiTokens.page.searchLabel',
        defaultMessage: 'Search tokens'
    },
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
    revoked: {
        id: 'apiTokens.page.revoked',
        defaultMessage: 'Token revoked'
    },
    results: {
        id: 'apiTokens.page.results',
        defaultMessage:
            '{count, plural, one {# API token} other {# API tokens}}'
    },
    prev: { id: 'apiTokens.page.prev', defaultMessage: 'Previous' },
    next: { id: 'apiTokens.page.next', defaultMessage: 'Next' },
    pageOf: {
        id: 'apiTokens.page.pageOf',
        defaultMessage: 'Page {page} of {pageCount}'
    }
});

/** Reads the `?status=` chip, falling back to the default Active view. */
function readStatus(value: string | null): ApiTokenStatus {
    return STATUS_CHIPS.find((status) => status === value) ?? 'active';
}

/** Every token the summary counts, whatever its status. */
function summaryTotal(summary: ApiTokenSummary | undefined): number {
    return summary ? summary.active + summary.expired + summary.revoked : 0;
}

/**
 * The global "API tokens" management page (rendered at `/api-tokens` in the main
 * admin sidebar's directory group — no workspace context). Lists tokens with
 * who made them and what is about to expire, filters them by status chip and
 * search, creates them (choosing the workspaces in the dialog), reveals the
 * plaintext once on creation together with a ready request, and revokes them
 * after saying what will break. Gated on `tokens:read`; the create/revoke
 * controls additionally require `tokens:create`/`tokens:delete`.
 */
export function ApiTokensPage() {
    const intl = useIntl();
    // Names this route in the tab strip, the window list, the history
    // and a screen reader's window announcement (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.title));
    const canRead = useHasPermission('tokens:read');
    const canCreate = useHasPermission('tokens:create');
    const canRevoke = useHasPermission('tokens:delete');

    // The page, the status chip and the search all live in the URL, like
    // `/users` and `/activity`: a filtered token list is linkable,
    // bookmarkable, and survives a reload or a Back.
    const [searchParams] = useSearchParams();
    const status = readStatus(searchParams.get('status'));
    const {
        page,
        searchParam,
        searchInput,
        setSearchInput,
        searchPending,
        updateParams
    } = useTableUrlState({
        searchKey: 'q',
        defaultPageSize: DEFAULT_PAGE_SIZE
    });
    const setPage = useCallback(
        (next: number) =>
            updateParams({ page: next <= 1 ? undefined : String(next) }, false),
        [updateParams]
    );
    const setStatus = (next: ApiTokenStatus) =>
        // Active is the default view, so it keeps no `?status=` of its own.
        updateParams({ status: next === 'active' ? undefined : next });

    const [createOpen, setCreateOpen] = useState(false);
    const [revealed, setRevealed] = useState<CreatedApiToken | null>(null);
    const [revoking, setRevoking] = useState<ApiToken | null>(null);

    const params = useMemo<ApiTokensListParams>(() => {
        const next: ApiTokensListParams = {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            status
        };
        if (searchParam) {
            next.q = searchParam;
        }
        return next;
    }, [page, status, searchParam]);

    const { data, isPending, isError, isFetching, isPlaceholderData, refetch } =
        useApiTokens(params, canRead);
    // The search field's spinner answers "is my search running?", so it
    // tracks only fetches the search caused — switching a status chip or a
    // page refetches too, and lighting the search field then reads as if the
    // chip had started a search. `searchedFor` is the term the list on screen
    // was last fetched with; the field is busy until the list catches up.
    const [searchedFor, setSearchedFor] = useState(searchParam);
    useEffect(() => {
        if (!isFetching) setSearchedFor(searchParam);
    }, [isFetching, searchParam]);
    const searchBusy =
        searchPending ||
        (isFetching && !isPending && searchParam !== searchedFor);
    // Workspace names and tiles for the table, the reveal summary and the
    // revoke confirmation; the create dialog reuses the same cached query.
    const { data: workspaces = [] } = useWorkspaceOptions(canRead);
    const workspacesById = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
        [workspaces]
    );
    const resolveWorkspace = useCallback(
        (id: string) => workspacesById.get(id),
        [workspacesById]
    );

    const createToken = useCreateApiToken();
    const revokeToken = useRevokeApiToken();

    /**
     * Drops the plaintext from the mutation cache. Closing the reveal dialog
     * clears the page's own copy, but the create mutation's cached *result*
     * carries the secret too, and TanStack keeps a settled mutation for its
     * `gcTime` — so without this the credential outlives the dialog that
     * promised it was gone and follows the user around the SPA. Pinned in a
     * ref so the unmount cleanup below can never re-run on an identity change.
     */
    const resetCreateRef = useRef(createToken.reset);
    resetCreateRef.current = createToken.reset;
    const forgetSecret = useCallback(() => {
        setRevealed(null);
        resetCreateRef.current();
    }, []);

    // Leaving the page with the reveal dialog still open never runs the handler
    // above, so scrub the mutation on unmount as well.
    useEffect(() => () => resetCreateRef.current(), []);

    // Focus anchor for after a revoke: the kebab that opened the confirmation
    // is unmounted by the same re-render that lands the new list, so Radix
    // restores focus to a dead element and it falls to `<body>` (WCAG 2.4.3).
    const resultsRef = useRef<HTMLDivElement>(null);
    const wasRevoking = useRef(false);
    useEffect(() => {
        if (revokeToken.isPending) {
            wasRevoking.current = true;
            return;
        }
        if (!wasRevoking.current) {
            return;
        }
        wasRevoking.current = false;
        // A frame later, so this runs after Radix's own restoration rather than
        // racing it — and only when that restoration actually lost focus.
        requestAnimationFrame(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                resultsRef.current?.focus();
            }
        });
    }, [revokeToken.isPending]);

    // The same anchor for the reveal dialog, which is opened programmatically
    // with no `DialogTrigger`, while the element focused when it opened — the
    // create dialog's submit — was unmounted in the very same tick. Radix has
    // nothing to restore to and focus would land on `<body>`.
    const hadSecret = useRef(false);
    useEffect(() => {
        if (revealed) {
            hadSecret.current = true;
            return;
        }
        if (!hadSecret.current) {
            return;
        }
        hadSecret.current = false;
        requestAnimationFrame(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                resultsRef.current?.focus();
            }
        });
    }, [revealed]);

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // Pull `page` back when the list shrinks under the current page — or when a
    // hand-typed `?page=` points past the end.
    useEffect(() => {
        if (data && page > pageCount) {
            setPage(pageCount);
        }
    }, [data, page, pageCount, setPage]);

    const topBar = (
        <PageTopBar
            icon={KeyRound}
            crumbs={[
                {
                    key: 'api-tokens',
                    label: intl.formatMessage(messages.title)
                }
            ]}
        />
    );

    if (!canRead) {
        return (
            <>
                {topBar}
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
    const summary = data?.summary;
    // A deployment with no tokens at all gets the "create your first" state;
    // an empty *view* of one that has some gets the no-match state instead.
    const noTokensAtAll =
        data !== undefined &&
        tokens.length === 0 &&
        summaryTotal(summary) === 0 &&
        !searchParam;

    const openCreate = () => setCreateOpen(true);

    const submitCreate = (input: CreateApiTokenInput) => {
        createToken.mutate(input, {
            onSuccess: (created) => {
                setCreateOpen(false);
                setRevealed(created);
            },
            onError: () => toast.error(intl.formatMessage(messages.createError))
        });
    };

    const confirmRevoke = (token: ApiToken) => {
        revokeToken.mutate(token.id, {
            onSuccess: () =>
                toast.success(intl.formatMessage(messages.revoked)),
            onError: () =>
                toast.error(intl.formatMessage(messages.revokeError)),
            // Closed either way: on failure the toast says so and the row is
            // still there, live, to try again from.
            onSettled: () => setRevoking(null)
        });
    };

    const subtitleParts = [intl.formatMessage(messages.subtitle)];
    if (summary) {
        subtitleParts.push(
            summary.expiringSoon > 0 && summary.nextExpiresAt
                ? intl.formatMessage(messages.subtitleSoon, {
                      active: summary.active,
                      soon: summary.expiringSoon,
                      days: daysUntil(summary.nextExpiresAt)
                  })
                : intl.formatMessage(messages.subtitleActive, {
                      active: summary.active
                  })
        );
    }

    return (
        <>
            {topBar}
            {canCreate ? (
                <PageActionsPortal>
                    <Button size="sm" onClick={openCreate}>
                        <Plus />
                        {intl.formatMessage(messages.create)}
                    </Button>
                </PageActionsPortal>
            ) : null}
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={subtitleParts.join(' · ')}
                />

                {noTokensAtAll ? null : (
                    <SearchToolbar
                        value={searchInput}
                        onValueChange={setSearchInput}
                        busy={searchBusy}
                        searchLabel={intl.formatMessage(messages.searchLabel)}
                        searchPlaceholder={intl.formatMessage(
                            messages.searchLabel
                        )}
                        leading={
                            <ApiTokensStatusChips
                                value={status}
                                summary={summary}
                                onChange={setStatus}
                            />
                        }
                    />
                )}

                {/* Creating, revoking, filtering and paging all change the
                    table without a navigation and without a heading change, so
                    announce the result count (WCAG 4.1.3) — the same region
                    `/users` and `/activity` carry. */}
                {!isPending && !isError ? (
                    <p role="status" aria-live="polite" className="sr-only">
                        {intl.formatMessage(messages.results, { count: total })}
                    </p>
                ) : null}

                {/* The focus anchor wraps every result state, not just the
                    table, so it is still mounted whichever state a mutation
                    lands the page in. `tabIndex={-1}` keeps it focusable
                    programmatically without adding a tab stop. */}
                <div ref={resultsRef} tabIndex={-1} className="outline-none">
                    {isPending ? (
                        <ApiTokensSkeleton />
                    ) : isError ? (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                                <span>
                                    {intl.formatMessage(messages.error)}
                                </span>
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
                    ) : noTokensAtAll ? (
                        <ApiTokensEmpty
                            onCreate={canCreate ? openCreate : undefined}
                        />
                    ) : tokens.length === 0 ? (
                        <ApiTokensNoMatch
                            status={status}
                            search={searchParam}
                            onClearSearch={() => setSearchInput('')}
                            onCreate={canCreate ? openCreate : undefined}
                        />
                    ) : (
                        <>
                            <ApiTokensTable
                                tokens={tokens}
                                canRevoke={canRevoke}
                                onRevoke={setRevoking}
                                resolveWorkspace={resolveWorkspace}
                                stale={isPlaceholderData}
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
                                            setPage(Math.max(1, page - 1))
                                        }
                                    >
                                        {intl.formatMessage(messages.prev)}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pageCount}
                                        onClick={() =>
                                            setPage(
                                                Math.min(pageCount, page + 1)
                                            )
                                        }
                                    >
                                        {intl.formatMessage(messages.next)}
                                    </Button>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </Container>

            <CreateApiTokenDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSubmit={submitCreate}
                submitting={createToken.isPending}
            />
            <RevealSecretDialog
                token={revealed}
                open={revealed !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        forgetSecret();
                    }
                }}
                resolveWorkspace={resolveWorkspace}
            />
            <RevokeApiTokenDialog
                token={revoking}
                onOpenChange={(open) => {
                    if (!open) {
                        setRevoking(null);
                    }
                }}
                onConfirm={confirmRevoke}
                busy={revokeToken.isPending}
                resolveWorkspace={resolveWorkspace}
            />
        </>
    );
}
