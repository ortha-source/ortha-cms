import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { MoreHorizontal } from 'lucide-react';
import {
    Badge,
    BadgeDot,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    cn
} from '@orthacms/design-system';
import { sinceParts, useJustCreated } from '@orthacms/utils-admin';
import { API_TOKENS_SCOPE } from '../../../application/useApiTokensMutation';
import { daysUntil } from '../../../domain/apiTokenExpiry';
import type { ApiToken } from '../../../domain/types/apiToken';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import { WorkspaceMonogram } from '../WorkspaceMonogram';

const messages = defineMessages({
    name: { id: 'apiTokens.table.name', defaultMessage: 'Name' },
    workspace: {
        id: 'apiTokens.table.workspace',
        defaultMessage: 'Workspaces'
    },
    token: { id: 'apiTokens.table.token', defaultMessage: 'Token' },
    scope: { id: 'apiTokens.table.scope', defaultMessage: 'Access' },
    status: { id: 'apiTokens.table.status', defaultMessage: 'Status' },
    expires: { id: 'apiTokens.table.expires', defaultMessage: 'Expires' },
    lastUsed: { id: 'apiTokens.table.lastUsed', defaultMessage: 'Last used' },
    actions: { id: 'apiTokens.table.actions', defaultMessage: 'Actions' },
    never: { id: 'apiTokens.table.never', defaultMessage: 'Never' },
    neverUsed: {
        id: 'apiTokens.table.neverUsed',
        defaultMessage: 'Never'
    },
    noExpiryLabel: {
        id: 'apiTokens.table.noExpiryLabel',
        defaultMessage: 'Not applicable, revoked'
    },
    expiresIn: {
        id: 'apiTokens.table.expiresIn',
        defaultMessage:
            '{days, plural, =0 {today} one {in # day} other {in # days}}'
    },
    createdBy: {
        id: 'apiTokens.table.createdBy',
        defaultMessage: 'by {name} · {date}'
    },
    createdOn: {
        id: 'apiTokens.table.createdOn',
        defaultMessage: 'Created {date}'
    },
    scopeRead: { id: 'apiTokens.table.scopeRead', defaultMessage: 'Read-only' },
    scopeFull: {
        id: 'apiTokens.table.scopeFull',
        defaultMessage: 'Full access'
    },
    statusActive: {
        id: 'apiTokens.table.statusActive',
        defaultMessage: 'Active'
    },
    statusExpiringSoon: {
        id: 'apiTokens.table.statusExpiringSoon',
        defaultMessage: 'Expires soon'
    },
    statusExpired: {
        id: 'apiTokens.table.statusExpired',
        defaultMessage: 'Expired'
    },
    statusRevoked: {
        id: 'apiTokens.table.statusRevoked',
        defaultMessage: 'Revoked'
    },
    revoke: { id: 'apiTokens.table.revoke', defaultMessage: 'Revoke' },
    caption: { id: 'apiTokens.table.caption', defaultMessage: 'API tokens' },
    open: {
        id: 'apiTokens.table.open',
        defaultMessage: 'Actions for {name}'
    }
});

/** "Aug 2" this year, "Dec 2024" before it — how the creation date reads. */
function formatCreated(intl: IntlShape, date: Date): string {
    return date.getFullYear() === new Date().getFullYear()
        ? intl.formatDate(date, { month: 'short', day: 'numeric' })
        : intl.formatDate(date, { month: 'short', year: 'numeric' });
}

/**
 * "2 min. ago", "yesterday" within the week, then a short date — with the
 * year only when it is not this one.
 */
export function formatLastUsed(intl: IntlShape, date: Date): string {
    const parts = sinceParts(date.toISOString());
    return parts.kind === 'relative'
        ? intl.formatRelativeTime(parts.value, parts.unit, {
              numeric: 'auto',
              style: 'short'
          })
        : intl.formatDate(parts.date, {
              month: 'short',
              day: 'numeric',
              year: parts.withYear ? 'numeric' : undefined
          });
}

/**
 * The tokens table: who made each token, where it reaches, what it may do,
 * whether it is live — and, for a live token expiring inside the window,
 * that it is about to break. A live token's row carries a kebab with Revoke
 * (gated by `canRevoke`); the page owns the confirmation.
 */
export function ApiTokensTable({
    tokens,
    canRevoke,
    onRevoke,
    resolveWorkspace,
    stale = false
}: {
    tokens: ApiToken[];
    canRevoke: boolean;
    /** Asks the page to confirm revoking this token. */
    onRevoke: (token: ApiToken) => void;
    /** The workspace behind an id, or `undefined` when the list lacks it. */
    resolveWorkspace: (id: string) => WorkspaceOption | undefined;
    /**
     * The rows are the previous page's result while the next one loads
     * (`isPlaceholderData`) — the table dims its body and goes `aria-busy`.
     */
    stale?: boolean;
}) {
    const intl = useIntl();
    const isJustCreated = useJustCreated(API_TOKENS_SCOPE);

    const headers = [
        messages.name,
        messages.workspace,
        messages.token,
        messages.scope,
        messages.status,
        messages.expires,
        messages.lastUsed
    ];

    return (
        <Table aria-label={intl.formatMessage(messages.caption)} stale={stale}>
            <TableHeader>
                <TableRow>
                    {headers.map((header) => (
                        <TableHead
                            key={header.id}
                            scope="col"
                            className="whitespace-nowrap"
                        >
                            {intl.formatMessage(header)}
                        </TableHead>
                    ))}
                    {canRevoke ? (
                        <TableHead scope="col" className="w-12">
                            <span className="sr-only">
                                {intl.formatMessage(messages.actions)}
                            </span>
                        </TableHead>
                    ) : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {tokens.map((token) => {
                    const live = token.status === 'active';
                    const creator =
                        token.createdBy?.name || token.createdBy?.email;
                    const created = formatCreated(intl, token.createdAt);
                    return (
                        <TableRow
                            key={token.id}
                            className={cn(
                                isJustCreated(token.id) && 'ds-flash'
                            )}
                        >
                            <TableCell
                                className={cn(
                                    'min-w-44',
                                    !live && 'text-muted-foreground'
                                )}
                            >
                                <span className="block font-medium">
                                    {token.name}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {creator
                                        ? intl.formatMessage(
                                              messages.createdBy,
                                              { name: creator, date: created }
                                          )
                                        : intl.formatMessage(
                                              messages.createdOn,
                                              { date: created }
                                          )}
                                </span>
                            </TableCell>
                            <TableCell>
                                <WorkspaceTiles
                                    workspaceIds={token.workspaceIds}
                                    resolveWorkspace={resolveWorkspace}
                                />
                            </TableCell>
                            <TableCell>
                                <code className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                    {token.lookupPrefix}…
                                </code>
                            </TableCell>
                            <TableCell>
                                {token.scope === 'full' ? (
                                    <Badge variant="warning" size="xs">
                                        {intl.formatMessage(messages.scopeFull)}
                                    </Badge>
                                ) : (
                                    <Badge variant="line" size="xs">
                                        {intl.formatMessage(messages.scopeRead)}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <StatusBadge token={token} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                <ExpiresCell token={token} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                {token.lastUsedAt
                                    ? formatLastUsed(intl, token.lastUsedAt)
                                    : intl.formatMessage(messages.neverUsed)}
                            </TableCell>
                            {canRevoke ? (
                                <TableCell className="text-right">
                                    {/* Only a live token has anything to
                                        switch off; an expired or revoked one
                                        gets no menu rather than an empty
                                        one. */}
                                    {live ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    aria-label={intl.formatMessage(
                                                        messages.open,
                                                        { name: token.name }
                                                    )}
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onSelect={() =>
                                                        onRevoke(token)
                                                    }
                                                >
                                                    {intl.formatMessage(
                                                        messages.revoke
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : null}
                                </TableCell>
                            ) : null}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

/**
 * A token's bucket as the workspaces' initials tiles, each named for a screen
 * reader (and on hover). An id the workspace list never heard of is shown raw
 * rather than dropped — an empty cell would read as "this token reaches
 * nothing".
 */
function WorkspaceTiles({
    workspaceIds,
    resolveWorkspace
}: {
    workspaceIds: string[];
    resolveWorkspace: (id: string) => WorkspaceOption | undefined;
}) {
    return (
        <span className="flex flex-wrap items-center gap-[3px]">
            {workspaceIds.map((workspaceId) => {
                const workspace = resolveWorkspace(workspaceId);
                if (!workspace) {
                    return (
                        <Badge
                            key={workspaceId}
                            variant="line"
                            size="xs"
                            className="font-mono"
                        >
                            {workspaceId}
                        </Badge>
                    );
                }
                return (
                    <span
                        key={workspaceId}
                        title={workspace.name}
                        className="inline-flex"
                    >
                        <WorkspaceMonogram workspace={workspace} />
                        <span className="sr-only">{workspace.name}</span>
                    </span>
                );
            })}
        </span>
    );
}

/** Active (green), Expires soon (amber), or a quiet Expired / Revoked. */
function StatusBadge({ token }: { token: ApiToken }) {
    const intl = useIntl();
    if (token.status !== 'active') {
        return (
            <Badge variant="muted" size="xs">
                {intl.formatMessage(
                    token.status === 'revoked'
                        ? messages.statusRevoked
                        : messages.statusExpired
                )}
            </Badge>
        );
    }
    return token.expiringSoon ? (
        <Badge variant="warning" size="xs">
            <BadgeDot />
            {intl.formatMessage(messages.statusExpiringSoon)}
        </Badge>
    ) : (
        <Badge variant="success" size="xs">
            <BadgeDot />
            {intl.formatMessage(messages.statusActive)}
        </Badge>
    );
}

/**
 * When the token stops working: "Never", a countdown for one expiring soon,
 * a date otherwise — and a dash for a revoked one, whose expiry no longer
 * means anything.
 */
function ExpiresCell({ token }: { token: ApiToken }) {
    const intl = useIntl();
    if (token.status === 'revoked') {
        return (
            <>
                <span aria-hidden className="text-muted-foreground">
                    —
                </span>
                <span className="sr-only">
                    {intl.formatMessage(messages.noExpiryLabel)}
                </span>
            </>
        );
    }
    if (!token.expiresAt) {
        return <>{intl.formatMessage(messages.never)}</>;
    }
    if (token.expiringSoon) {
        return (
            <span className="text-warning-soft-foreground">
                {intl.formatMessage(messages.expiresIn, {
                    days: daysUntil(token.expiresAt)
                })}
            </span>
        );
    }
    return <>{intl.formatDate(token.expiresAt, { dateStyle: 'medium' })}</>;
}
