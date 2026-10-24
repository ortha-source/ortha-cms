import { defineMessages, useIntl } from 'react-intl';
import { Check, Copy, Info, Mail } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    toast
} from '@orthacms/design-system';
import type { SentInvite } from '../../../../application/useInviteMembersFlow';

/** Intl descriptors for {@link InviteMembersSent}, co-located. */
const messages = defineMessages({
    copy: { id: 'users.inviteSent.copy', defaultMessage: 'Copy link' },
    copyFor: {
        id: 'users.inviteSent.copyFor',
        defaultMessage: 'Copy link for {email}'
    },
    copied: { id: 'users.inviteSent.copied', defaultMessage: 'Copied' },
    copiedToast: {
        id: 'users.inviteSent.copiedToast',
        defaultMessage: 'Invite link for {email} copied'
    },
    copyFailed: {
        id: 'users.inviteSent.copyFailed',
        defaultMessage:
            'Couldn’t reach the clipboard. Select the link and copy it manually.'
    },
    linkLabel: {
        id: 'users.inviteLink.linkLabel',
        defaultMessage: 'Invite link for {email}'
    },
    noWorkspaces: {
        id: 'users.inviteSent.noWorkspaces',
        defaultMessage: 'no workspaces'
    },
    detail: {
        id: 'users.inviteSent.detail',
        defaultMessage: '{role} · {workspaces}'
    },
    list: {
        id: 'users.inviteSent.list',
        defaultMessage: 'Invite links'
    },
    untilAccepted: {
        id: 'users.inviteSent.untilAccepted',
        defaultMessage:
            'Until they accept, they show as <b>Invited</b> in Members — resend or revoke from there.'
    }
});

/**
 * The invite sheet's result: **a link per person**. Without mail each invite
 * shows its own link with Copy, and a "Copied" badge once it reached the
 * clipboard — the sheet uses that to ask before closing over a link nobody
 * copied. With mail the links were sent, and this is just the list of who.
 */
export function InviteMembersSent({
    invites,
    roleLabel,
    workspaceNames,
    copied,
    onCopied
}: {
    /** The invites the batch created. */
    invites: SentInvite[];
    /** The role they were all given, localized. */
    roleLabel: string;
    /** The workspaces they were all added to. */
    workspaceNames: string[];
    /** Ids of the invites whose link has been copied. */
    copied: ReadonlySet<string>;
    /** Records that an invite's link reached the clipboard. */
    onCopied: (id: string) => void;
}) {
    const intl = useIntl();
    const detail = intl.formatMessage(messages.detail, {
        role: roleLabel,
        workspaces:
            workspaceNames.length > 0
                ? intl.formatList(workspaceNames)
                : intl.formatMessage(messages.noWorkspaces)
    });

    const copy = async (invite: SentInvite) => {
        if (!invite.link) {
            return;
        }
        try {
            await navigator.clipboard.writeText(invite.link);
            onCopied(invite.id);
            toast.success(
                intl.formatMessage(messages.copiedToast, {
                    email: invite.email
                })
            );
        } catch {
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <ul
                aria-label={intl.formatMessage(messages.list)}
                className="divide-y overflow-hidden rounded-lg border"
            >
                {invites.map((invite) => (
                    <li key={invite.id} className="flex flex-col gap-2.5 p-3.5">
                        <div className="flex items-start gap-2.5">
                            <Mail
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {invite.email}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {detail}
                                </p>
                            </div>
                            {copied.has(invite.id) ? (
                                <Badge size="xs" variant="success">
                                    <Check aria-hidden className="size-3" />
                                    {intl.formatMessage(messages.copied)}
                                </Badge>
                            ) : null}
                        </div>
                        {invite.link ? (
                            <div className="flex min-w-0 items-center gap-2">
                                <input
                                    readOnly
                                    value={invite.link}
                                    aria-label={intl.formatMessage(
                                        messages.linkLabel,
                                        { email: invite.email }
                                    )}
                                    onFocus={(event) =>
                                        event.currentTarget.select()
                                    }
                                    className="h-9 min-w-0 flex-1 truncate rounded-md border border-dashed bg-muted/40 px-3 font-mono text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="shrink-0"
                                    aria-label={intl.formatMessage(
                                        messages.copyFor,
                                        { email: invite.email }
                                    )}
                                    onClick={() => copy(invite)}
                                >
                                    <Copy aria-hidden />
                                    {intl.formatMessage(messages.copy)}
                                </Button>
                            </div>
                        ) : null}
                    </li>
                ))}
            </ul>

            <Alert variant="info" role="note">
                <Info aria-hidden />
                <AlertDescription>
                    {intl.formatMessage(messages.untilAccepted, {
                        b: (chunks) => (
                            <strong key="b" className="font-semibold">
                                {chunks}
                            </strong>
                        )
                    })}
                </AlertDescription>
            </Alert>
        </div>
    );
}
