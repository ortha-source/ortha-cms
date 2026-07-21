import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Button,
    ConfirmDialog,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import type {
    ApiToken,
    ApiTokenScope,
    ApiTokenStatus
} from '../../../domain/types/apiToken';

const messages = defineMessages({
    name: { id: 'apiTokens.table.name', defaultMessage: 'Name' },
    workspace: {
        id: 'apiTokens.table.workspace',
        defaultMessage: 'Workspace'
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
    scopeRead: { id: 'apiTokens.table.scopeRead', defaultMessage: 'Read-only' },
    scopeFull: { id: 'apiTokens.table.scopeFull', defaultMessage: 'Full' },
    statusActive: {
        id: 'apiTokens.table.statusActive',
        defaultMessage: 'Active'
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
    confirmTitle: {
        id: 'apiTokens.table.confirmTitle',
        defaultMessage: 'Revoke this token?'
    },
    confirmBody: {
        id: 'apiTokens.table.confirmBody',
        defaultMessage:
            'Any app using “{name}” will immediately lose access. This can’t be undone.'
    }
});

const SCOPE_LABEL: Record<ApiTokenScope, keyof typeof messages> = {
    read: 'scopeRead',
    full: 'scopeFull'
};

const STATUS_LABEL: Record<ApiTokenStatus, keyof typeof messages> = {
    active: 'statusActive',
    expired: 'statusExpired',
    revoked: 'statusRevoked'
};

const STATUS_VARIANT: Record<
    ApiTokenStatus,
    'default' | 'secondary' | 'outline'
> = {
    active: 'default',
    expired: 'secondary',
    revoked: 'outline'
};

/**
 * The tokens table. Each live token can be revoked (gated by `canRevoke`); the
 * confirm dialog is owned here and calls the parent's `onRevoke`. `revokingId`
 * marks the row whose revoke is in flight so its button shows a busy state and
 * can't double-submit.
 */
export function ApiTokensTable({
    tokens,
    canRevoke,
    onRevoke,
    revokingId,
    resolveWorkspaceName
}: {
    tokens: ApiToken[];
    canRevoke: boolean;
    onRevoke: (id: string) => void;
    revokingId: string | null;
    resolveWorkspaceName: (id: string) => string;
}) {
    const intl = useIntl();
    const [pending, setPending] = useState<ApiToken | null>(null);

    const formatDate = (date: Date | null, fallback: string) =>
        date ? intl.formatDate(date, { dateStyle: 'medium' }) : fallback;

    return (
        <>
            <Table className="mt-4">
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            {intl.formatMessage(messages.name)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.workspace)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.token)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.scope)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.status)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.expires)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.lastUsed)}
                        </TableHead>
                        {canRevoke ? (
                            <TableHead className="text-right">
                                <span className="sr-only">
                                    {intl.formatMessage(messages.actions)}
                                </span>
                            </TableHead>
                        ) : null}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tokens.map((token) => (
                        <TableRow key={token.id}>
                            <TableCell className="font-medium">
                                {token.name}
                            </TableCell>
                            <TableCell>
                                {resolveWorkspaceName(token.workspaceId)}
                            </TableCell>
                            <TableCell>
                                <code className="font-mono text-xs text-muted-foreground">
                                    {token.lookupPrefix}…
                                </code>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={
                                        token.scope === 'full'
                                            ? 'default'
                                            : 'secondary'
                                    }
                                >
                                    {intl.formatMessage(
                                        messages[SCOPE_LABEL[token.scope]]
                                    )}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={STATUS_VARIANT[token.status]}>
                                    {intl.formatMessage(
                                        messages[STATUS_LABEL[token.status]]
                                    )}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {formatDate(
                                    token.expiresAt,
                                    intl.formatMessage(messages.never)
                                )}
                            </TableCell>
                            <TableCell>
                                {formatDate(
                                    token.lastUsedAt,
                                    intl.formatMessage(messages.neverUsed)
                                )}
                            </TableCell>
                            {canRevoke ? (
                                <TableCell className="text-right">
                                    {token.status === 'active' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPending(token)}
                                        >
                                            {intl.formatMessage(messages.revoke)}
                                        </Button>
                                    ) : null}
                                </TableCell>
                            ) : null}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <ConfirmDialog
                open={pending !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPending(null);
                    }
                }}
                title={intl.formatMessage(messages.confirmTitle)}
                description={intl.formatMessage(messages.confirmBody, {
                    name: pending?.name ?? ''
                })}
                confirmLabel={intl.formatMessage(messages.revoke)}
                confirmVariant="destructive"
                busy={pending !== null && revokingId === pending.id}
                onConfirm={() => {
                    if (pending) {
                        onRevoke(pending.id);
                        setPending(null);
                    }
                }}
            />
        </>
    );
}
