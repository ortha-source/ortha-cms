import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Ban,
    Check,
    CircleCheck,
    Copy,
    Laptop,
    Smartphone
} from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Badge,
    Button,
    ConfirmDialog,
    Skeleton,
    Spinner,
    toast
} from '@orthacms/design-system';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { useUnsavedChanges } from '@orthacms/utils-admin';
import {
    useUserSessions,
    type UserSession
} from '../../../application/useUserSessions';
import { useRevokeSession } from '../../../application/useRevokeSession';
import { useRevokeAllSessions } from '../../../application/useRevokeAllSessions';
import { useIssuePasswordReset } from '../../../application/useIssuePasswordReset';
import { useSetMemberStatus } from '../../../application/useSetMemberStatus';
import { MemberEntity } from '../../../domain/member';
import { describeUserAgent } from '../../../domain/userAgent';
import type { Member } from '../../../domain/types/member';
import { memberConflictOf } from '../../../infrastructure/memberConflict';
import { passwordResetLinkFor } from '../../../infrastructure/passwordResetLink';
import { MemberCard } from '../../components/MemberCard';
import { shortNameOf } from '../../memberNames';
import { useRecencyFormatter } from '../../recencyLabel';
import { useUserDetailContext } from '../../userDetailContext';

/** Intl descriptors for {@link UserAccessPage}, co-located with the page. */
const messages = defineMessages({
    sessions: { id: 'users.sessions.title', defaultMessage: 'Sessions' },
    signOutEverywhere: {
        id: 'users.sessions.signOutEverywhere',
        defaultMessage: 'Sign out everywhere'
    },
    noSessions: {
        id: 'users.sessions.empty',
        defaultMessage: 'No active sessions.'
    },
    sessionsFailed: {
        id: 'users.sessions.error',
        defaultMessage: 'Couldn’t load sessions. Please try again.'
    },
    retry: { id: 'users.sessions.retry', defaultMessage: 'Retry' },
    unknownDevice: {
        id: 'users.sessions.unknownDevice',
        defaultMessage: 'Unknown device'
    },
    device: {
        id: 'users.sessions.device',
        defaultMessage: '{browser} on {os}'
    },
    thisSession: {
        id: 'users.sessions.current',
        defaultMessage: 'This session'
    },
    revoke: { id: 'users.sessions.revoke', defaultMessage: 'Revoke' },
    revokeLabel: {
        id: 'users.sessions.revokeLabel',
        defaultMessage: 'Revoke the session on {device}, {when}'
    },
    confirmRevokeTitle: {
        id: 'users.sessions.confirmTitle',
        defaultMessage: 'Revoke the session on {device}?'
    },
    confirmRevokeBody: {
        id: 'users.sessions.confirmBody',
        defaultMessage:
            'Last seen {when}{ip}. That device will be signed out immediately and must sign in again.'
    },
    confirmRevokeBodyIp: {
        id: 'users.sessions.confirmBodyIp',
        defaultMessage: ' from {ip}'
    },
    revoked: {
        id: 'users.sessions.revoked',
        defaultMessage: 'Session revoked.'
    },
    revokeFailed: {
        id: 'users.sessions.failed',
        defaultMessage: 'Couldn’t revoke the session. Please try again.'
    },
    confirmAllTitle: {
        id: 'users.sessions.confirmAllTitle',
        defaultMessage: 'Sign {name} out everywhere?'
    },
    confirmAllBody: {
        id: 'users.sessions.confirmAllBody',
        defaultMessage:
            '{self, select, true {Every other device signed in as you is signed out now. This one stays signed in.} other {Every device signed in as {email} is signed out now. They can sign in again — to keep them out, suspend them instead.}}'
    },
    signedOut: {
        id: 'users.sessions.signedOut',
        defaultMessage:
            '{count, plural, =0 {There were no other sessions to end.} one {Ended # session.} other {Ended # sessions.}}'
    },
    password: { id: 'users.passwordReset.title', defaultMessage: 'Password' },
    passwordBody: {
        id: 'users.passwordReset.body',
        defaultMessage:
            'Generate a one-time link {name} can use to set a new password.'
    },
    passwordShare: {
        id: 'users.passwordReset.share',
        defaultMessage:
            'Generate a one-time link {name} can use to set a new password. Mail is off, so share it yourself.'
    },
    generate: {
        id: 'users.passwordReset.generate',
        defaultMessage: 'Generate reset link'
    },
    generating: {
        id: 'users.passwordReset.generating',
        defaultMessage: 'Generating reset link…'
    },
    copy: { id: 'users.passwordReset.copy', defaultMessage: 'Copy' },
    copyLabel: {
        id: 'users.passwordReset.copyLabel',
        defaultMessage: 'Copy the password reset link'
    },
    copied: {
        id: 'users.passwordReset.copied',
        defaultMessage: 'Password reset link copied to clipboard'
    },
    copyFailed: {
        id: 'users.passwordReset.copyFailed',
        defaultMessage:
            'Couldn’t reach the clipboard. Select the link and copy it manually.'
    },
    linkLabel: {
        id: 'users.passwordResetLink.linkLabel',
        defaultMessage: 'Password reset link for {email}'
    },
    linkHint: {
        id: 'users.passwordReset.linkHint',
        defaultMessage:
            '{minutes, plural, =0 {Works once. Generating another one replaces it.} other {Works once, for {duration}. Generating another one replaces it.}}'
    },
    hours: {
        id: 'users.passwordReset.hours',
        defaultMessage: '{count, plural, one {# hour} other {# hours}}'
    },
    minutes: {
        id: 'users.passwordReset.minutes',
        defaultMessage: '{count, plural, one {# minute} other {# minutes}}'
    },
    mailed: {
        id: 'users.passwordReset.mailed',
        defaultMessage: 'A reset link is on its way to {email}.'
    },
    pendingReset: {
        id: 'users.passwordReset.pending',
        defaultMessage:
            'This member hasn’t accepted their invite, so there’s no password to reset. Resend their invite instead.'
    },
    disabledReset: {
        id: 'users.passwordReset.disabled',
        defaultMessage:
            'This member is suspended and can’t sign in, so a reset link would do nothing. Reactivate them first.'
    },
    recentlyIssued: {
        id: 'users.passwordReset.recentlyIssued',
        defaultMessage:
            'A reset link was just generated for this member. Wait {seconds, plural, one {a second} other {# seconds}} — generating another now would kill the one you already have.'
    },
    resetConflict: {
        id: 'users.passwordReset.conflict',
        defaultMessage:
            'This member’s account changed while you were looking at it. Reload the page and try again.'
    },
    resetFailed: {
        id: 'users.passwordReset.failed',
        defaultMessage: 'Couldn’t generate a reset link. Please try again.'
    },
    suspendTitle: {
        id: 'users.access.suspendTitle',
        defaultMessage: 'Suspend {name}'
    },
    suspendBody: {
        id: 'users.access.suspendBody',
        defaultMessage:
            'Signs them out everywhere and stops new sign-ins. Their records, roles and workspaces stay.'
    },
    suspend: { id: 'users.access.suspend', defaultMessage: 'Suspend member' },
    reactivateTitle: {
        id: 'users.access.reactivateTitle',
        defaultMessage: '{name} is suspended'
    },
    reactivateBody: {
        id: 'users.access.reactivateBody',
        defaultMessage:
            'They can’t sign in. Reactivating restores access straight away — their records, roles and workspaces were kept.'
    },
    reactivate: {
        id: 'users.access.reactivate',
        defaultMessage: 'Reactivate member'
    },
    pendingTitle: {
        id: 'users.access.pendingTitle',
        defaultMessage: 'Invite not accepted yet'
    },
    pendingBody: {
        id: 'users.access.pendingBody',
        defaultMessage:
            'This member hasn’t accepted their invite, so there’s no sign-in access to suspend yet.'
    },
    confirmSuspendTitle: {
        id: 'users.access.confirmSuspendTitle',
        defaultMessage: 'Suspend {name}?'
    },
    confirmSuspendBody: {
        id: 'users.access.confirmSuspendBody',
        defaultMessage:
            'They’ll be signed out everywhere and blocked from signing in until reactivated.'
    },
    confirmReactivateTitle: {
        id: 'users.access.confirmReactivateTitle',
        defaultMessage: 'Reactivate {name}?'
    },
    confirmReactivateBody: {
        id: 'users.access.confirmReactivateBody',
        defaultMessage: 'They’ll be able to sign in again right away.'
    },
    lastAdmin: {
        id: 'users.access.lastAdmin',
        defaultMessage:
            '{name} is the last admin and can’t be suspended — make someone else admin first.'
    },
    self: {
        id: 'users.access.self',
        defaultMessage: 'You can’t suspend your own account.'
    },
    suspended: {
        id: 'users.access.suspended',
        defaultMessage: 'Suspended {name}.'
    },
    reactivated: {
        id: 'users.access.reactivated',
        defaultMessage: 'Reactivated {name}.'
    },
    statusFailed: {
        id: 'users.access.failed',
        defaultMessage: 'Couldn’t update sign-in access. Please try again.'
    }
});

/**
 * **Sessions & access** — everything about signing in, together, where it
 * used to be three tabs: the member's live sessions (each revocable, or all at
 * once), the one-time password link, and — apart, as the risky one — suspend.
 *
 * Gated on `users:update` at the route. Each card follows the member's status:
 * an invite has no sessions or password yet, a suspended member is offered
 * reactivation instead of suspension.
 */
export function UserAccessPage() {
    const { member } = useUserDetailContext();

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
                <SessionsCard member={member} />
                <PasswordCard member={member} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
                <SuspendCard member={member} />
            </div>
        </div>
    );
}

/** A session's device in everyday words: "Safari on macOS". */
function useDeviceName() {
    const intl = useIntl();
    return (session: UserSession) => {
        const { browser, os } = describeUserAgent(session.userAgent);
        if (browser && os) {
            return intl.formatMessage(messages.device, { browser, os });
        }
        // Half a recognition ("Linux") would hide which browser it was; the
        // raw string says more than a guess.
        return (
            session.userAgent?.trim() ||
            intl.formatMessage(messages.unknownDevice)
        );
    };
}

/** The member's live sessions, each revocable, plus Sign out everywhere. */
function SessionsCard({ member }: { member: Member }) {
    const intl = useIntl();
    const { user } = useAuth();
    const deviceName = useDeviceName();
    const formatRecency = useRecencyFormatter();
    const pending = member.status === 'pending';
    const {
        data: sessions,
        isPending,
        isError,
        refetch
    } = useUserSessions(member.id, !pending);
    const revoke = useRevokeSession();
    const revokeAll = useRevokeAllSessions();
    const [revoking, setRevoking] = useState<UserSession | null>(null);
    const [confirmingAll, setConfirmingAll] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const isSelf = user?.id === member.id;
    const name = shortNameOf(member);

    /**
     * A revoked row unmounts, so Radix has no trigger to hand focus back to
     * and it falls to `<body>` (WCAG 2.4.3). Send it to the card's heading — a
     * stable anchor that also re-announces where the user is.
     */
    const restoreFocus = () =>
        requestAnimationFrame(() => headingRef.current?.focus());

    const onRevoke = () => {
        if (!revoking) {
            return;
        }
        revoke.mutate(
            { userId: member.id, sessionId: revoking.id },
            {
                onSuccess: () => {
                    toast.success(intl.formatMessage(messages.revoked));
                    setRevoking(null);
                    restoreFocus();
                },
                onError: () => {
                    toast.error(intl.formatMessage(messages.revokeFailed));
                    setRevoking(null);
                    restoreFocus();
                }
            }
        );
    };

    const onRevokeAll = () =>
        revokeAll.mutate(member.id, {
            onSuccess: (count) => {
                toast.success(
                    intl.formatMessage(messages.signedOut, { count })
                );
                setConfirmingAll(false);
                restoreFocus();
            },
            onError: () => {
                toast.error(intl.formatMessage(messages.revokeFailed));
                setConfirmingAll(false);
                restoreFocus();
            }
        });

    const revocable = (sessions ?? []).filter((session) => !session.current);

    return (
        <MemberCard
            title={intl.formatMessage(messages.sessions)}
            count={sessions?.length}
            headingRef={headingRef}
            action={
                revocable.length > 0 ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingAll(true)}
                    >
                        {intl.formatMessage(messages.signOutEverywhere)}
                    </Button>
                ) : null
            }
        >
            {pending ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noSessions)}
                </p>
            ) : isPending ? (
                <div className="flex flex-col gap-2 p-4">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </div>
            ) : isError ? (
                <div className="p-4">
                    <Alert variant="destructive">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>
                                {intl.formatMessage(messages.sessionsFailed)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            ) : sessions.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noSessions)}
                </p>
            ) : (
                <ul>
                    {sessions.map((session) => {
                        const device = deviceName(session);
                        const when = formatRecency(
                            session.lastSeenAt,
                            'activeInline'
                        );
                        const Icon = describeUserAgent(session.userAgent).mobile
                            ? Smartphone
                            : Laptop;
                        return (
                            <li
                                key={session.id}
                                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                            >
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"
                                >
                                    <Icon className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className="flex items-center gap-2 truncate text-sm font-medium"
                                        title={session.userAgent ?? undefined}
                                    >
                                        <span className="truncate">
                                            {device}
                                        </span>
                                        {session.current ? (
                                            <Badge size="xs" variant="muted">
                                                {intl.formatMessage(
                                                    messages.thisSession
                                                )}
                                            </Badge>
                                        ) : null}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {[session.ipAddress, when]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                {/* The visible word is "Revoke" on every row,
                                    so the accessible name carries the device —
                                    otherwise a screen reader hears the same
                                    label on all of them (WCAG 2.4.6 / 4.1.2). */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        session.current ||
                                        (revoke.isPending &&
                                            revoking?.id === session.id)
                                    }
                                    aria-label={intl.formatMessage(
                                        messages.revokeLabel,
                                        { device, when }
                                    )}
                                    onClick={() => setRevoking(session)}
                                >
                                    {intl.formatMessage(messages.revoke)}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRevoking(null);
                        restoreFocus();
                    }
                }}
                busy={revoke.isPending}
                // Name the device: on a member with several sessions an
                // unnamed one is indistinguishable from the others.
                title={intl.formatMessage(messages.confirmRevokeTitle, {
                    device: revoking ? deviceName(revoking) : ''
                })}
                description={intl.formatMessage(messages.confirmRevokeBody, {
                    when: revoking
                        ? intl.formatDate(revoking.lastSeenAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                          })
                        : '',
                    ip: revoking?.ipAddress
                        ? intl.formatMessage(messages.confirmRevokeBodyIp, {
                              ip: revoking.ipAddress
                          })
                        : ''
                })}
                confirmLabel={intl.formatMessage(messages.revoke)}
                confirmVariant="destructive"
                onConfirm={onRevoke}
            />

            <ConfirmDialog
                open={confirmingAll}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmingAll(false);
                        restoreFocus();
                    }
                }}
                busy={revokeAll.isPending}
                title={intl.formatMessage(messages.confirmAllTitle, { name })}
                description={intl.formatMessage(messages.confirmAllBody, {
                    self: String(isSelf),
                    email: member.email
                })}
                confirmLabel={intl.formatMessage(messages.signOutEverywhere)}
                confirmVariant="destructive"
                onConfirm={onRevokeAll}
            />
        </MemberCard>
    );
}

/** A reset link's lifetime in words ("1 hour", "30 minutes"). */
function useDuration() {
    const intl = useIntl();
    return (minutes: number) =>
        minutes % 60 === 0
            ? intl.formatMessage(messages.hours, { count: minutes / 60 })
            : intl.formatMessage(messages.minutes, { count: minutes });
}

/**
 * The one-time password link, generated and shown **in place** with Copy.
 * With no mailer the link exists only here, so leaving the page before
 * copying it asks first (the app-wide unsaved-changes guard), as the invite
 * links do; with one, the server emails it and this says so.
 */
function PasswordCard({ member }: { member: Member }) {
    const intl = useIntl();
    const canUpdate = useHasPermission('users:update');
    const issueReset = useIssuePasswordReset();
    const duration = useDuration();
    const [link, setLink] = useState<{
        url: string;
        minutes: number;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const name = shortNameOf(member);

    useUnsavedChanges(link !== null && !copied, 'users.password.link');

    const blockedReason =
        member.status === 'pending'
            ? messages.pendingReset
            : member.status === 'disabled'
              ? messages.disabledReset
              : null;

    const generate = () =>
        issueReset.mutate(member.id, {
            onSuccess: (issued) => {
                if (!issued.resetToken) {
                    setLink(null);
                    toast.success(
                        intl.formatMessage(messages.mailed, {
                            email: member.email
                        })
                    );
                    return;
                }
                setCopied(false);
                setLink({
                    url: passwordResetLinkFor(issued.resetToken),
                    minutes: issued.resetExpiresAt
                        ? Math.max(
                              1,
                              Math.round(
                                  (issued.resetExpiresAt.getTime() -
                                      Date.now()) /
                                      60_000
                              )
                          )
                        : 0
                });
            },
            onError: (error) => {
                // A 409 is actionable and the body says how: the cooldown
                // carries the wait, so the admin is told to hold rather than
                // told "something conflicted" and left to guess.
                const conflict = memberConflictOf(error);
                if (conflict) {
                    toast.error(
                        conflict.code === 'PASSWORD_RESET_RECENTLY_SENT'
                            ? intl.formatMessage(messages.recentlyIssued, {
                                  seconds: conflict.retryAfterSeconds ?? 60
                              })
                            : intl.formatMessage(messages.resetConflict)
                    );
                    return;
                }
                toast.error(intl.formatMessage(messages.resetFailed));
            }
        });

    const copy = async () => {
        if (!link) {
            return;
        }
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
            toast.success(intl.formatMessage(messages.copied));
        } catch {
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    return (
        <MemberCard title={intl.formatMessage(messages.password)}>
            <div className="flex flex-col gap-3 p-4">
                {blockedReason ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(blockedReason)}
                    </p>
                ) : link ? (
                    <>
                        <p className="text-sm">
                            {intl.formatMessage(messages.passwordShare, {
                                name
                            })}
                        </p>
                        <div className="flex min-w-0 items-center gap-2">
                            <input
                                readOnly
                                value={link.url}
                                aria-label={intl.formatMessage(
                                    messages.linkLabel,
                                    { email: member.email }
                                )}
                                onFocus={(event) =>
                                    event.currentTarget.select()
                                }
                                className="h-9 min-w-0 flex-1 truncate rounded-md border border-dashed bg-muted/40 px-3 font-mono text-xs"
                            />
                            <Button
                                variant="outline"
                                className="shrink-0"
                                aria-label={intl.formatMessage(
                                    messages.copyLabel
                                )}
                                onClick={copy}
                            >
                                {copied ? (
                                    <Check aria-hidden />
                                ) : (
                                    <Copy aria-hidden />
                                )}
                                {intl.formatMessage(messages.copy)}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.linkHint, {
                                minutes: link.minutes,
                                duration: duration(link.minutes)
                            })}
                        </p>
                    </>
                ) : (
                    <p className="text-sm">
                        {intl.formatMessage(messages.passwordBody, { name })}
                    </p>
                )}
                {!blockedReason && canUpdate ? (
                    <div>
                        <Button
                            variant="outline"
                            onClick={generate}
                            disabled={issueReset.isPending}
                        >
                            {issueReset.isPending ? (
                                <>
                                    <Spinner aria-hidden="true" />
                                    <span className="sr-only">
                                        {intl.formatMessage(
                                            messages.generating
                                        )}
                                    </span>
                                </>
                            ) : null}
                            {intl.formatMessage(messages.generate)}
                        </Button>
                    </div>
                ) : null}
            </div>
        </MemberCard>
    );
}

/** Suspend — or, for a suspended member, reactivate — apart as the risky one. */
function SuspendCard({ member }: { member: Member }) {
    const intl = useIntl();
    const { user } = useAuth();
    const setStatus = useSetMemberStatus();
    const [confirming, setConfirming] = useState(false);
    const name = shortNameOf(member);
    const isDisabled = member.status === 'disabled';

    if (member.status === 'pending') {
        return (
            <MemberCard title={intl.formatMessage(messages.pendingTitle)}>
                <p className="p-4 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.pendingBody)}
                </p>
            </MemberCard>
        );
    }

    // Mirror the server's guardrails: you can't suspend yourself or the sole
    // admin. They only block the suspend direction — reactivating a suspended
    // member is always allowed.
    const removal = MemberEntity.of(member).canBeRemoved(user?.id);
    const blockedReason =
        isDisabled || removal.ok
            ? null
            : removal.reason === 'self'
              ? messages.self
              : messages.lastAdmin;

    const run = () =>
        setStatus.mutate(
            { id: member.id, disabled: !isDisabled },
            {
                onSuccess: (updated) => {
                    setConfirming(false);
                    toast.success(
                        intl.formatMessage(
                            isDisabled
                                ? messages.reactivated
                                : messages.suspended,
                            { name: updated.name }
                        )
                    );
                },
                onError: () => {
                    setConfirming(false);
                    toast.error(intl.formatMessage(messages.statusFailed));
                }
            }
        );

    return (
        <MemberCard
            tone={isDisabled ? 'default' : 'danger'}
            title={intl.formatMessage(
                isDisabled ? messages.reactivateTitle : messages.suspendTitle,
                { name }
            )}
        >
            <div className="flex flex-col gap-3 p-4">
                <p className="text-sm">
                    {intl.formatMessage(
                        isDisabled
                            ? messages.reactivateBody
                            : messages.suspendBody
                    )}
                </p>
                {blockedReason ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(blockedReason, { name })}
                    </p>
                ) : null}
                <div>
                    <Button
                        variant="outline"
                        className={
                            isDisabled
                                ? undefined
                                : 'text-destructive hover:text-destructive'
                        }
                        onClick={() => setConfirming(true)}
                        disabled={blockedReason !== null || setStatus.isPending}
                    >
                        {isDisabled ? (
                            <CircleCheck aria-hidden />
                        ) : (
                            <Ban aria-hidden />
                        )}
                        {intl.formatMessage(
                            isDisabled ? messages.reactivate : messages.suspend
                        )}
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                busy={setStatus.isPending}
                title={intl.formatMessage(
                    isDisabled
                        ? messages.confirmReactivateTitle
                        : messages.confirmSuspendTitle,
                    { name: member.name }
                )}
                description={intl.formatMessage(
                    isDisabled
                        ? messages.confirmReactivateBody
                        : messages.confirmSuspendBody
                )}
                confirmLabel={intl.formatMessage(
                    isDisabled ? messages.reactivate : messages.suspend
                )}
                confirmVariant={isDisabled ? 'default' : 'destructive'}
                onConfirm={run}
            />
        </MemberCard>
    );
}
