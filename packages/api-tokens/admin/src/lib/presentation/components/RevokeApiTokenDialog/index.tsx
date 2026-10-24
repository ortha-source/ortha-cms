import { defineMessages, useIntl } from 'react-intl';
import { Ban } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner
} from '@orthacms/design-system';
import type { ApiToken } from '../../../domain/types/apiToken';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import { formatLastUsed } from '../ApiTokensTable';

const messages = defineMessages({
    title: {
        id: 'apiTokens.revoke.title',
        defaultMessage: 'Revoke “{name}”?'
    },
    used: {
        id: 'apiTokens.revoke.used',
        defaultMessage:
            'Anything using it stops at once — it was last used <b>{when}</b>, on {workspaces}.'
    },
    neverUsed: {
        id: 'apiTokens.revoke.neverUsed',
        defaultMessage:
            'It has never been used, so nothing should break — it covers {workspaces}.'
    },
    fullAccess: {
        id: 'apiTokens.revoke.fullAccess',
        defaultMessage:
            'It has full access: whatever relies on it to create, update or publish content stops too.'
    },
    hint: {
        id: 'apiTokens.revoke.hint',
        defaultMessage:
            'This can’t be undone. Create a new token first if anything still needs one.'
    },
    cancel: { id: 'apiTokens.revoke.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'apiTokens.revoke.confirm',
        defaultMessage: 'Revoke token'
    }
});

/**
 * The revoke confirmation, saying what will break: when the token was last
 * used and on which workspaces — the two facts that decide whether to revoke
 * now or mint a replacement first — and, for a full-access token, that writes
 * stop too. While the revoke is in flight the dialog cannot be dismissed and
 * its confirm shows a spinner, so a second request cannot be fired.
 */
export function RevokeApiTokenDialog({
    token,
    onOpenChange,
    onConfirm,
    busy,
    resolveWorkspace
}: {
    /** The token being revoked, or `null` when the dialog is closed. */
    token: ApiToken | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: (token: ApiToken) => void;
    busy: boolean;
    resolveWorkspace: (id: string) => WorkspaceOption | undefined;
}) {
    const intl = useIntl();

    const workspaces = token
        ? intl.formatList(
              token.workspaceIds.map((id) => resolveWorkspace(id)?.name ?? id),
              { type: 'conjunction' }
          )
        : '';

    return (
        <Dialog
            open={token !== null}
            onOpenChange={(next) => {
                if (!busy) onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            name: token?.name ?? ''
                        })}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-3">
                            <p className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive-soft-foreground">
                                <Ban
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0 text-destructive"
                                />
                                <span>
                                    {token?.lastUsedAt
                                        ? intl.formatMessage(messages.used, {
                                              when: formatLastUsed(
                                                  intl,
                                                  token.lastUsedAt
                                              ),
                                              workspaces,
                                              b: (chunks) => (
                                                  <strong key="when">
                                                      {chunks}
                                                  </strong>
                                              )
                                          })
                                        : intl.formatMessage(
                                              messages.neverUsed,
                                              { workspaces }
                                          )}
                                    {token?.scope === 'full' ? (
                                        <>
                                            {' '}
                                            {intl.formatMessage(
                                                messages.fullAccess
                                            )}
                                        </>
                                    ) : null}
                                </span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.hint)}
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => (token ? onConfirm(token) : undefined)}
                        disabled={busy}
                    >
                        {busy ? <Spinner /> : null}
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
