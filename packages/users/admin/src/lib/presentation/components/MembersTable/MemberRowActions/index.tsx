import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    ArrowRight,
    Ban,
    CircleCheck,
    Copy,
    KeyRound,
    Layers,
    LogOut,
    MoreHorizontal,
    Send,
    Trash2,
    Users
} from 'lucide-react';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner,
    cn,
    toast
} from '@orthacms/design-system';
import { inviteLinkFor } from '../../../../infrastructure/inviteLink';
import { passwordResetLinkFor } from '../../../../infrastructure/passwordResetLink';
import { useIssuePasswordReset } from '../../../../application/useIssuePasswordReset';
import { useResendInvite } from '../../../../application/useResendInvite';
import { useRevokeAllSessions } from '../../../../application/useRevokeAllSessions';
import { useRevokeInvite } from '../../../../application/useRevokeInvite';
import { useSetMemberStatus } from '../../../../application/useSetMemberStatus';
import {
    MemberEntity,
    type MemberBlockReason
} from '../../../../domain/member';
import type { Member } from '../../../../domain/types/member';
import { memberConflictOf } from '../../../../infrastructure/memberConflict';
import { shortNameOf } from '../../../memberNames';
import { MEMBERS_RESULTS_ANCHOR_ID } from '../../../membersResultsAnchor';
import { ChangeRoleDialog } from '../../ChangeRoleDialog';
import { InviteLinkDialog } from '../../InviteLinkDialog';
import { PasswordResetLinkDialog } from '../../PasswordResetLinkDialog';

/** Intl descriptors for {@link MemberRowActions}, co-located with the component. */
const messages = defineMessages({
    open: {
        id: 'users.actions.open',
        defaultMessage: 'Actions for {name}'
    },
    invitedLabel: {
        id: 'users.actions.invitedLabel',
        defaultMessage: '{name} · invited'
    },
    openProfile: {
        id: 'users.actions.openProfile',
        defaultMessage: 'Open profile'
    },
    changeRole: {
        id: 'users.actions.changeRole',
        defaultMessage: 'Change role…'
    },
    workspaces: {
        id: 'users.actions.workspaces',
        defaultMessage: 'Workspaces…'
    },
    resetLink: {
        id: 'users.actions.resetLink',
        defaultMessage: 'Password reset link'
    },
    signOutEverywhere: {
        id: 'users.actions.signOutEverywhere',
        defaultMessage: 'Sign out everywhere'
    },
    suspend: {
        id: 'users.actions.suspend',
        defaultMessage: 'Suspend…'
    },
    reactivate: {
        id: 'users.actions.reactivate',
        defaultMessage: 'Reactivate'
    },
    resend: {
        id: 'users.actions.resend',
        defaultMessage: 'Resend invite'
    },
    resendShort: {
        id: 'users.actions.resendShort',
        defaultMessage: 'Resend'
    },
    resendFor: {
        id: 'users.actions.resendFor',
        defaultMessage: 'Resend the invite to {email}'
    },
    copyLink: {
        id: 'users.actions.copyLink',
        defaultMessage: 'Copy invite link'
    },
    revoke: {
        id: 'users.actions.revoke',
        defaultMessage: 'Revoke invite…'
    },
    blockedSelf: {
        id: 'users.actions.blocked.self',
        defaultMessage: 'This is you — another admin has to do this.'
    },
    blockedLastAdmin: {
        id: 'users.actions.blocked.lastAdmin',
        defaultMessage:
            '{name} is the last admin — make someone else admin first.'
    },
    blockedCustomRole: {
        id: 'users.actions.blocked.customRole',
        defaultMessage:
            '{name} holds a custom role, which can’t be changed here.'
    },
    suspended: {
        id: 'users.actions.suspended.toast',
        defaultMessage: 'Suspended {name}.'
    },
    reactivated: {
        id: 'users.actions.reactivated.toast',
        defaultMessage: 'Reactivated {name}.'
    },
    signedOut: {
        id: 'users.actions.signedOut.toast',
        defaultMessage:
            '{count, plural, =0 {{name} had no other sessions to end.} one {Signed {name} out of # session.} other {Signed {name} out of # sessions.}}'
    },
    inviteMailed: {
        id: 'users.actions.inviteMailed.toast',
        defaultMessage: 'A fresh invitation is on its way to {email}.'
    },
    resetMailed: {
        id: 'users.actions.resetMailed.toast',
        defaultMessage: 'A reset link is on its way to {email}.'
    },
    revoked: {
        id: 'users.actions.revoked.toast',
        defaultMessage: 'Revoked the invite for {email}'
    },
    inviteCooldown: {
        id: 'users.actions.inviteCooldown.toast',
        defaultMessage:
            'An invite link was just created for {email}. Wait {seconds, plural, one {a second} other {# seconds}} — a new one now would kill the one you have.'
    },
    resetCooldown: {
        id: 'users.actions.resetCooldown.toast',
        defaultMessage:
            'A reset link was just generated. Wait {seconds, plural, one {a second} other {# seconds}} — a new one now would kill the one you have.'
    },
    actionFailed: {
        id: 'users.actions.failed.toast',
        defaultMessage: 'Something went wrong. Please try again.'
    },
    confirmSuspendTitle: {
        id: 'users.actions.confirmSuspend.title',
        defaultMessage: 'Suspend {name}?'
    },
    confirmSuspendBody: {
        id: 'users.actions.confirmSuspend.body',
        defaultMessage:
            '{email} will be signed out everywhere and blocked from signing in until reactivated. Their records, roles and workspaces stay.'
    },
    confirmSuspendAction: {
        id: 'users.actions.confirmSuspend.action',
        defaultMessage: 'Suspend member'
    },
    confirmSignOutTitle: {
        id: 'users.actions.confirmSignOut.title',
        defaultMessage: 'Sign {name} out everywhere?'
    },
    confirmSignOutBody: {
        id: 'users.actions.confirmSignOut.body',
        defaultMessage:
            'Every device signed in as {email} is signed out now. They can sign in again — to keep them out, suspend them instead.'
    },
    confirmRevokeTitle: {
        id: 'users.actions.confirmRevoke.title',
        defaultMessage: 'Delete this invite permanently?'
    },
    confirmRevokeBody: {
        id: 'users.actions.confirmRevoke.body',
        defaultMessage:
            'The pending account for {email} and its workspace assignments are deleted. This cannot be undone — you would have to invite them again and re-choose their workspaces.'
    },
    confirmRevokeAction: {
        id: 'users.actions.confirmRevoke.action',
        defaultMessage: 'Delete invite'
    }
});

/** The reason copy for each guard. */
const BLOCK_MESSAGE: Record<
    MemberBlockReason,
    (typeof messages)[keyof typeof messages]
> = {
    self: messages.blockedSelf,
    lastAdmin: messages.blockedLastAdmin,
    customRole: messages.blockedCustomRole
};

/** Which confirmation is open. */
type Confirming = 'suspend' | 'revoke' | 'signOut' | null;

/**
 * A member's actions, **following their status** — the roster row's kebab
 * (`variant="row"`) and the member page's `⋯` (`variant="detail"`):
 *
 * - **active** — Open profile, Change role…, Workspaces…, then the sign-in
 *   tools (Password reset link, Sign out everywhere), then Suspend… apart as
 *   the risky one;
 * - **invited** — Resend invite, Copy invite link, then Revoke invite…; the
 *   row also offers Resend as a button beside the kebab, since it is the one
 *   thing an invited row is usually waiting for;
 * - **suspended** — Open profile, Workspaces…, then Reactivate.
 *
 * The page variant leaves out what the page already shows (Open profile, and
 * Change role, which has its own button in the header).
 *
 * **A guarded item says why, inline.** Your own role and suspension, the last
 * admin and a custom role keep their item visible but inert, with the reason
 * written inside it — not in a hover-only tooltip a keyboard user never sees.
 * The item stays focusable (`aria-disabled`, not Radix `disabled`, which would
 * skip it), its name is just the action, and the reason is its description.
 *
 * **Copy invite link** issues a fresh link: only the token's hash is stored, so
 * the link that was handed out cannot be shown again. The dialog that follows
 * says the old link has stopped working.
 */
export function MemberRowActions({
    member,
    variant = 'row',
    onRemoved
}: {
    /** The member the actions are about. */
    member: Member;
    /** Where the menu lives. */
    variant?: 'row' | 'detail';
    /**
     * Called after an action removed the member (revoking an invite deletes
     * the pending account). The row variant moves focus to the roster by
     * itself; the page variant passes a way out of a page that no longer
     * exists.
     */
    onRemoved?: () => void;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const { user } = useAuth();
    const canUpdate = useHasPermission('users:update');
    const canInvite = useHasPermission('users:create');
    const canRevoke = useHasPermission('users:delete');

    const setStatus = useSetMemberStatus();
    const resendInvite = useResendInvite();
    const revokeInvite = useRevokeInvite();
    const issueReset = useIssuePasswordReset();
    const revokeAll = useRevokeAllSessions();

    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [resetLink, setResetLink] = useState<string | null>(null);
    const [changingRole, setChangingRole] = useState(false);
    const [confirming, setConfirming] = useState<Confirming>(null);
    const reasonId = useId();

    const name = shortNameOf(member);
    const entity = MemberEntity.of(member);
    const roleGuard = entity.canChangeRole(user?.id);
    const removalGuard = entity.canBeRemoved(user?.id);
    const base = `/users/${member.id}`;
    const kebabId = `member-actions-${variant}-${member.id}`;

    const failed = () => toast.error(intl.formatMessage(messages.actionFailed));

    /**
     * Put focus back on a stable anchor after an overlay closes. Radix
     * restores focus to whatever opened it, but the menu that opened a dialog
     * has unmounted by then — and a row-removing mutation unmounts the row
     * too — so focus would land on `<body>` (WCAG 2.4.3). Deferred a frame so
     * this runs after Radix's own restoration rather than racing it.
     */
    const restoreFocusTo = (selector: string) => {
        requestAnimationFrame(() => {
            document.querySelector<HTMLElement>(selector)?.focus();
        });
    };
    const focusKebab = () => restoreFocusTo(`#${CSS.escape(kebabId)}`);

    /** Rotates the invite and hands the new link over (or says it was mailed). */
    const rotateInvite = () =>
        resendInvite.mutate(member.id, {
            onSuccess: (invited) => {
                // No token means the server emailed the fresh link and kept
                // the only copy (ADR-0018 §4); there is nothing to hand over.
                if (!invited.inviteToken) {
                    toast.success(
                        intl.formatMessage(messages.inviteMailed, {
                            email: member.email
                        })
                    );
                    return;
                }
                setInviteLink(inviteLinkFor(invited.inviteToken));
            },
            onError: (error) => {
                const conflict = memberConflictOf(error);
                if (conflict?.code === 'INVITE_RECENTLY_SENT') {
                    toast.error(
                        intl.formatMessage(messages.inviteCooldown, {
                            email: member.email,
                            seconds: conflict.retryAfterSeconds ?? 60
                        })
                    );
                    return;
                }
                failed();
            }
        });

    const generateResetLink = () =>
        issueReset.mutate(member.id, {
            onSuccess: (issued) => {
                if (!issued.resetToken) {
                    toast.success(
                        intl.formatMessage(messages.resetMailed, {
                            email: member.email
                        })
                    );
                    return;
                }
                setResetLink(passwordResetLinkFor(issued.resetToken));
            },
            onError: (error) => {
                const conflict = memberConflictOf(error);
                if (conflict?.code === 'PASSWORD_RESET_RECENTLY_SENT') {
                    toast.error(
                        intl.formatMessage(messages.resetCooldown, {
                            seconds: conflict.retryAfterSeconds ?? 60
                        })
                    );
                    return;
                }
                failed();
            }
        });

    const reactivate = () =>
        setStatus.mutate(
            { id: member.id, disabled: false },
            {
                onSuccess: () =>
                    toast.success(
                        intl.formatMessage(messages.reactivated, {
                            name: member.name
                        })
                    ),
                onError: failed
            }
        );

    /** Delete the pending account. The row (or page) goes with it. */
    const confirmRevoke = () =>
        revokeInvite.mutate(member.id, {
            onSuccess: () => {
                setConfirming(null);
                toast.success(
                    intl.formatMessage(messages.revoked, {
                        email: member.email
                    })
                );
                if (onRemoved) {
                    onRemoved();
                } else {
                    // The row is gone; fall back to the roster's results
                    // region, which wraps every result state and so is still
                    // mounted even when this was the last row.
                    restoreFocusTo(`#${MEMBERS_RESULTS_ANCHOR_ID}`);
                }
            },
            onError: () => {
                setConfirming(null);
                focusKebab();
                failed();
            }
        });

    /** Suspend sign-in. The row stays (its badge flips), so focus its kebab. */
    const confirmSuspend = () =>
        setStatus.mutate(
            { id: member.id, disabled: true },
            {
                onSuccess: () => {
                    setConfirming(null);
                    focusKebab();
                    toast.success(
                        intl.formatMessage(messages.suspended, {
                            name: member.name
                        })
                    );
                },
                onError: () => {
                    setConfirming(null);
                    focusKebab();
                    failed();
                }
            }
        );

    const confirmSignOut = () =>
        revokeAll.mutate(member.id, {
            onSuccess: (count) => {
                setConfirming(null);
                focusKebab();
                toast.success(
                    intl.formatMessage(messages.signedOut, {
                        count,
                        name: member.name
                    })
                );
            },
            onError: () => {
                setConfirming(null);
                focusKebab();
                failed();
            }
        });

    // The guards, and where their reasons are written. One reason shared by
    // both guarded items (yourself, the last admin) is written once, inside
    // the last of them — as the board draws it — and the first points at it.
    const roleReason =
        canUpdate && !roleGuard.ok ? BLOCK_MESSAGE[roleGuard.reason] : null;
    const suspendReason =
        canUpdate && !removalGuard.ok
            ? BLOCK_MESSAGE[removalGuard.reason]
            : null;
    const roleShowsChangeRole =
        variant === 'row' && canUpdate && member.status === 'active';
    const shared =
        roleShowsChangeRole &&
        roleReason !== null &&
        roleReason === suspendReason;
    const reasonText = (reason: (typeof messages)[keyof typeof messages]) =>
        intl.formatMessage(reason, { name });

    let label: string = member.name;
    let items: ReactNode[] = [];

    if (member.status === 'pending') {
        label = intl.formatMessage(messages.invitedLabel, {
            name: member.name
        });
        const primary = canInvite
            ? [
                  <DropdownMenuItem key="resend" onSelect={rotateInvite}>
                      <Send aria-hidden />
                      {intl.formatMessage(messages.resend)}
                  </DropdownMenuItem>,
                  <DropdownMenuItem key="copy" onSelect={rotateInvite}>
                      <Copy aria-hidden />
                      {intl.formatMessage(messages.copyLink)}
                  </DropdownMenuItem>
              ]
            : [];
        const danger = canRevoke ? (
            <DropdownMenuItem
                key="revoke"
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirming('revoke')}
            >
                <Trash2 aria-hidden />
                {intl.formatMessage(messages.revoke)}
            </DropdownMenuItem>
        ) : null;
        items = [
            primary.length > 0 ? (
                <DropdownMenuGroup key="primary">{primary}</DropdownMenuGroup>
            ) : null,
            primary.length > 0 && danger ? (
                <DropdownMenuSeparator key="sep" />
            ) : null,
            danger ? (
                <DropdownMenuGroup key="danger">{danger}</DropdownMenuGroup>
            ) : null
        ];
    } else {
        const account: ReactNode[] = [];
        if (variant === 'row') {
            account.push(
                <DropdownMenuItem key="profile" onSelect={() => navigate(base)}>
                    <ArrowRight aria-hidden />
                    {intl.formatMessage(messages.openProfile)}
                </DropdownMenuItem>
            );
        }
        if (roleShowsChangeRole) {
            account.push(
                <GuardedItem
                    key="role"
                    icon={<Users aria-hidden />}
                    label={intl.formatMessage(messages.changeRole)}
                    reason={
                        roleReason && !shared ? reasonText(roleReason) : null
                    }
                    blocked={roleReason !== null}
                    reasonId={`${reasonId}-role`}
                    describedBy={shared ? `${reasonId}-suspend` : undefined}
                    onSelect={() => setChangingRole(true)}
                />
            );
        }
        account.push(
            <DropdownMenuItem
                key="workspaces"
                onSelect={() => navigate(`${base}/workspaces`)}
            >
                <Layers aria-hidden />
                {intl.formatMessage(messages.workspaces)}
            </DropdownMenuItem>
        );

        const signIn: ReactNode[] =
            canUpdate && member.status === 'active'
                ? [
                      <DropdownMenuItem
                          key="reset"
                          onSelect={generateResetLink}
                      >
                          <KeyRound aria-hidden />
                          {intl.formatMessage(messages.resetLink)}
                      </DropdownMenuItem>,
                      <DropdownMenuItem
                          key="signOut"
                          onSelect={() => setConfirming('signOut')}
                      >
                          <LogOut aria-hidden />
                          {intl.formatMessage(messages.signOutEverywhere)}
                      </DropdownMenuItem>
                  ]
                : [];

        let danger: ReactNode = null;
        if (canUpdate && member.status === 'active') {
            danger = (
                <GuardedItem
                    key="suspend"
                    destructive
                    icon={<Ban aria-hidden />}
                    label={intl.formatMessage(messages.suspend)}
                    reason={suspendReason ? reasonText(suspendReason) : null}
                    blocked={suspendReason !== null}
                    reasonId={`${reasonId}-suspend`}
                    onSelect={() => setConfirming('suspend')}
                />
            );
        } else if (canUpdate && member.status === 'disabled') {
            danger = (
                <DropdownMenuItem key="reactivate" onSelect={reactivate}>
                    <CircleCheck aria-hidden />
                    {intl.formatMessage(messages.reactivate)}
                </DropdownMenuItem>
            );
        }

        items = [
            <DropdownMenuGroup key="account">{account}</DropdownMenuGroup>,
            signIn.length > 0 ? <DropdownMenuSeparator key="sep1" /> : null,
            signIn.length > 0 ? (
                <DropdownMenuGroup key="signIn">{signIn}</DropdownMenuGroup>
            ) : null,
            danger ? <DropdownMenuSeparator key="sep2" /> : null,
            danger ? (
                <DropdownMenuGroup key="danger">{danger}</DropdownMenuGroup>
            ) : null
        ];
    }

    const confirmBusy =
        revokeInvite.isPending || setStatus.isPending || revokeAll.isPending;
    const confirmCopy =
        confirming === 'revoke'
            ? {
                  title: intl.formatMessage(messages.confirmRevokeTitle),
                  body: intl.formatMessage(messages.confirmRevokeBody, {
                      email: member.email
                  }),
                  action: intl.formatMessage(messages.confirmRevokeAction),
                  run: confirmRevoke
              }
            : confirming === 'signOut'
              ? {
                    title: intl.formatMessage(messages.confirmSignOutTitle, {
                        name: member.name
                    }),
                    body: intl.formatMessage(messages.confirmSignOutBody, {
                        email: member.email
                    }),
                    action: intl.formatMessage(messages.signOutEverywhere),
                    run: confirmSignOut
                }
              : {
                    title: intl.formatMessage(messages.confirmSuspendTitle, {
                        name: member.name
                    }),
                    body: intl.formatMessage(messages.confirmSuspendBody, {
                        email: member.email
                    }),
                    action: intl.formatMessage(messages.confirmSuspendAction),
                    run: confirmSuspend
                };

    const showInlineResend =
        variant === 'row' && member.status === 'pending' && canInvite;

    return (
        <div className="flex items-center justify-end gap-1">
            {showInlineResend ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={resendInvite.isPending}
                    aria-label={intl.formatMessage(messages.resendFor, {
                        email: member.email
                    })}
                    onClick={rotateInvite}
                >
                    {resendInvite.isPending ? <Spinner aria-hidden /> : null}
                    {intl.formatMessage(messages.resendShort)}
                </Button>
            ) : null}
            {/* `modal={false}` so the open menu doesn't aria-hide the page root
            (which holds focusable content) — a row menu needs no background
            trap. */}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        id={kebabId}
                        variant={variant === 'detail' ? 'outline' : 'ghost'}
                        size="icon"
                        className={variant === 'detail' ? 'size-9' : 'size-8'}
                        aria-label={intl.formatMessage(messages.open, {
                            name: member.name
                        })}
                    >
                        <MoreHorizontal aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                        {label}
                    </DropdownMenuLabel>
                    {items}
                </DropdownMenuContent>
            </DropdownMenu>

            <InviteLinkDialog
                link={inviteLink}
                email={member.email}
                open={inviteLink !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setInviteLink(null);
                        focusKebab();
                    }
                }}
            />

            <PasswordResetLinkDialog
                link={resetLink}
                email={member.email}
                open={resetLink !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setResetLink(null);
                        focusKebab();
                    }
                }}
            />

            {roleShowsChangeRole ? (
                <ChangeRoleDialog
                    member={member}
                    open={changingRole}
                    onOpenChange={(open) => {
                        setChangingRole(open);
                        if (!open) {
                            focusKebab();
                        }
                    }}
                />
            ) : null}

            <ConfirmDialog
                open={confirming !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirming(null);
                        focusKebab();
                    }
                }}
                busy={confirmBusy}
                title={confirmCopy.title}
                description={confirmCopy.body}
                confirmLabel={confirmCopy.action}
                confirmVariant="destructive"
                onConfirm={confirmCopy.run}
            />
        </div>
    );
}

/**
 * A menu item a guardrail can veto. Vetoed (`blocked`), it stays visible and
 * focusable but inert — `aria-disabled`, selection suppressed — and, when it
 * carries the `reason`, writes it under its label inside the item. Its name is
 * the label alone (`aria-labelledby`); the reason is its description. When two
 * items share one reason the first passes `describedBy`, pointing at the
 * second's, rather than writing it twice.
 */
function GuardedItem({
    icon,
    label,
    blocked,
    reason,
    reasonId,
    describedBy,
    destructive = false,
    onSelect
}: {
    icon: ReactNode;
    label: string;
    blocked: boolean;
    reason: string | null;
    reasonId: string;
    describedBy?: string;
    destructive?: boolean;
    onSelect: () => void;
}) {
    const labelId = useId();

    if (!blocked) {
        return (
            <DropdownMenuItem
                onSelect={onSelect}
                className={cn(
                    destructive && 'text-destructive focus:text-destructive'
                )}
            >
                {icon}
                {label}
            </DropdownMenuItem>
        );
    }

    return (
        <DropdownMenuItem
            aria-disabled
            aria-labelledby={labelId}
            aria-describedby={reason ? reasonId : describedBy}
            className="flex-col items-start gap-1 text-muted-foreground focus:bg-transparent focus:text-muted-foreground [&_svg]:opacity-60"
            onSelect={(event) => event.preventDefault()}
        >
            <span id={labelId} className="flex items-center gap-2">
                {icon}
                {label}
            </span>
            {reason ? (
                <span id={reasonId} className="text-xs leading-4">
                    {reason}
                </span>
            ) : null}
        </DropdownMenuItem>
    );
}
