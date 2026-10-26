import { useId, useState, type FormEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Navigate, useNavigate } from 'react-router-dom';
import { Send, TriangleAlert, Users } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle, useUnsavedChanges } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    Container,
    ContainerHeader,
    Label,
    Spinner
} from '@orthacms/design-system';
import {
    useInviteMembersFlow,
    type SentInvite
} from '../../../application/useInviteMembersFlow';
import { useExistingEmails } from '../../../application/useExistingEmails';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import { Email } from '../../../domain/value-objects/email';
import type { MemberRole } from '../../../domain/types/member';
import { EmailChipsInput } from '../../components/EmailChipsInput';
import { InviteMembersSent } from '../../components/InviteMembersSent';
import { InviteWorkspaceTiles } from '../../components/InviteWorkspaceTiles';
import { RolePicker, ROLE_NAME_MESSAGES } from '../../components/RolePicker';
import { CALLOUT_ALERT_CLASS, CALLOUT_ICON_CLASS } from '../../calloutAlert';

/** Intl descriptors for {@link InviteMembersPage}, co-located. */
const messages = defineMessages({
    crumbMembers: {
        id: 'users.invitePage.crumbMembers',
        defaultMessage: 'Members'
    },
    title: { id: 'users.inviteSheet.title', defaultMessage: 'Invite people' },
    description: {
        id: 'users.inviteSheet.description',
        defaultMessage:
            'They get a link to set a password, or sign in with SSO.'
    },
    emails: { id: 'users.inviteSheet.emails', defaultMessage: 'Emails' },
    role: { id: 'users.inviteSheet.role', defaultMessage: 'Role' },
    roleHint: {
        id: 'users.inviteSheet.roleHint',
        defaultMessage: 'One role across Ortha — not per workspace.'
    },
    workspaces: {
        id: 'users.inviteSheet.workspaces',
        defaultMessage: 'Workspaces'
    },
    taken: {
        id: 'users.inviteSheet.taken',
        defaultMessage:
            '{count, plural, one {{emails} is already a member — remove it to continue.} other {{emails} are already members — remove them to continue.}}'
    },
    malformed: {
        id: 'users.inviteSheet.malformed',
        defaultMessage:
            '{count, plural, one {{emails} isn’t an email address.} other {{emails} aren’t email addresses.}}'
    },
    empty: {
        id: 'users.inviteSheet.empty',
        defaultMessage: 'Add at least one email address.'
    },
    failed: {
        id: 'users.inviteSheet.failed',
        defaultMessage:
            'Couldn’t send the invites. Nobody was invited — try again.'
    },
    summary: {
        id: 'users.inviteSheet.summary',
        defaultMessage:
            '{people, plural, one {# person} other {# people}} · {role} · {workspaces, plural, =0 {no workspaces} one {# workspace} other {# workspaces}}'
    },
    cancel: { id: 'users.inviteSheet.cancel', defaultMessage: 'Cancel' },
    send: {
        id: 'users.inviteSheet.send',
        defaultMessage:
            '{count, plural, =0 {Send invites} one {Send # invite} other {Send # invites}}'
    },
    sending: {
        id: 'users.inviteSheet.sending',
        defaultMessage: 'Sending invites…'
    },
    sentTitle: {
        id: 'users.inviteSheet.sentTitle',
        defaultMessage:
            '{count, plural, one {# invite created} other {# invites created}}'
    },
    sentLinks: {
        id: 'users.inviteSheet.sentLinks',
        defaultMessage:
            '{days, plural, =0 {Mail isn’t set up on this server, so send each link yourself. They work once.} one {Mail isn’t set up on this server, so send each link yourself. They work once and expire in # day.} other {Mail isn’t set up on this server, so send each link yourself. They work once and expire in # days.}}'
    },
    sentMailed: {
        id: 'users.inviteSheet.sentMailed',
        defaultMessage:
            '{count, plural, one {Email sent to # person.} other {Emails sent to # people.}}'
    },
    inviteMore: {
        id: 'users.inviteSheet.inviteMore',
        defaultMessage: 'Invite more'
    },
    done: { id: 'users.inviteSheet.done', defaultMessage: 'Done' },
    uncopied: {
        id: 'users.inviteSheet.uncopied',
        defaultMessage:
            '{count, plural, one {A link hasn’t been copied yet, and it can’t be shown again. Leave now and that person has no working invite until you resend it.} other {# links haven’t been copied yet, and they can’t be shown again. Leave now and those people have no working invite until you resend them.}}'
    },
    keepOpen: {
        id: 'users.inviteSheet.keepOpen',
        defaultMessage: 'Keep it open'
    },
    leaveAnyway: {
        id: 'users.inviteSheet.leaveAnyway',
        defaultMessage: 'Leave without copying'
    }
});

/** The finished batch, frozen as it was sent. */
type SentBatch = {
    invites: SentInvite[];
    role: MemberRole;
    workspaceNames: string[];
};

/**
 * **Invite people** — a page at `/users/invite` in the app's ordinary frame
 * (top bar "Members › Invite people", `ContainerHeader`), with two states on
 * the one route:
 *
 * 1. **The form.** Addresses as chips (several at once — paste a list), one
 *    role as cards, workspaces as tiles (or "all workspaces"), and Send, which
 *    counts the invites. A malformed address, or one that already belongs to
 *    a member, turns its chip red with the reason under the field, and Send
 *    stays off until it is removed: the batch is all-or-nothing server-side,
 *    so sending around a bad chip would only fail. The "already a member"
 *    check reads the ordinary member list as the admin types
 *    (`useExistingEmails`); the server's `409` naming addresses stays the
 *    authority and lands in the same place.
 * 2. **A link per person.** With no mailer every invite's link is shown once
 *    with its own Copy. Leaving the page while one is uncopied — Done, the
 *    breadcrumb, the sidebar, a reload — asks first through the app-wide
 *    unsaved-changes guard, because none of them can be shown again; "Invite
 *    more" asks inline before clearing them. With a mailer it is one line:
 *    who was sent an email.
 *
 * Gated on `users:create`; without it the route returns to the roster.
 */
export function InviteMembersPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));
    const navigate = useNavigate();
    const canInvite = useHasPermission('users:create');
    const canRead = useHasPermission('users:read');
    const flow = useInviteMembersFlow();
    const workspaces = useWorkspaceOptions(canInvite);

    const [emails, setEmails] = useState<string[]>([]);
    const [role, setRole] = useState<MemberRole>('contributor');
    const [workspaceIds, setWorkspaceIds] = useState<Set<string>>(new Set());
    const [triedEmpty, setTriedEmpty] = useState(false);
    const [sent, setSent] = useState<SentBatch | null>(null);
    const [copied, setCopied] = useState<Set<string>>(new Set());
    const [confirmingMore, setConfirmingMore] = useState(false);

    const fieldId = useId();
    const errorId = useId();
    const roleLabelId = useId();
    const workspacesLabelId = useId();

    const existing = useExistingEmails(
        emails,
        canInvite && canRead && sent === null
    );

    const uncopied =
        sent?.invites.filter(
            (invite) => invite.link !== null && !copied.has(invite.id)
        ) ?? [];

    // The links exist only in this page's state. Leaving by any route — Done,
    // a link, a reload — asks first while one has not been copied.
    useUnsavedChanges(uncopied.length > 0, 'users.invite.links');

    if (!canInvite) {
        return <Navigate to="/users" replace />;
    }

    const malformed = emails.filter((email) => !Email.isValid(email));
    const taken = emails.filter(
        (email) => existing.data?.has(email) || flow.takenEmails.includes(email)
    );
    const flagged = new Set([...malformed, ...taken]);
    const sendable = emails.filter((email) => !flagged.has(email));

    const fieldErrors: string[] = [];
    if (taken.length > 0) {
        fieldErrors.push(
            intl.formatMessage(messages.taken, {
                count: taken.length,
                emails: intl.formatList(taken)
            })
        );
    }
    if (malformed.length > 0) {
        fieldErrors.push(
            intl.formatMessage(messages.malformed, {
                count: malformed.length,
                emails: intl.formatList(malformed)
            })
        );
    }
    if (triedEmpty && emails.length === 0) {
        fieldErrors.push(intl.formatMessage(messages.empty));
    }

    const options = workspaces.data ?? [];
    const roleLabel = intl.formatMessage(ROLE_NAME_MESSAGES[role]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (emails.length === 0) {
            setTriedEmpty(true);
            return;
        }
        if (flagged.size > 0 || flow.submitting) {
            return;
        }
        const invites = await flow.submit({
            emails,
            role,
            workspaceIds: [...workspaceIds]
        });
        if (invites) {
            setSent({
                invites,
                role,
                workspaceNames: options
                    .filter((option) => workspaceIds.has(option.id))
                    .map((option) => option.name)
            });
            setCopied(new Set());
        }
    };

    /** Back to an empty form, keeping the role and workspaces just used. */
    const startOver = () => {
        flow.reset();
        setSent(null);
        setEmails([]);
        setTriedEmpty(false);
        setConfirmingMore(false);
    };

    const toggleWorkspace = (id: string) =>
        setWorkspaceIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

    const expiresInDays = (() => {
        const expiry = sent?.invites.find(
            (invite) => invite.expiresAt
        )?.expiresAt;
        if (!expiry) {
            return 0;
        }
        return Math.max(
            1,
            Math.round((expiry.getTime() - Date.now()) / 86_400_000)
        );
    })();
    const mailed = sent !== null && sent.invites.every((i) => !i.link);

    const topBar = (
        <PageTopBar
            icon={Users}
            iconClassName="bg-success-soft text-success-soft-foreground"
            crumbs={[
                {
                    key: 'members',
                    label: intl.formatMessage(messages.crumbMembers),
                    to: '/users'
                },
                {
                    key: 'invite',
                    label: intl.formatMessage(messages.title)
                }
            ]}
        />
    );

    if (sent) {
        return (
            <>
                {topBar}
                <Container className="max-w-[720px]">
                    <ContainerHeader
                        title={intl.formatMessage(messages.sentTitle, {
                            count: sent.invites.length
                        })}
                        subtitle={
                            mailed
                                ? intl.formatMessage(messages.sentMailed, {
                                      count: sent.invites.length
                                  })
                                : intl.formatMessage(messages.sentLinks, {
                                      days: expiresInDays
                                  })
                        }
                    />
                    <div className="flex flex-col gap-4">
                        <InviteMembersSent
                            invites={sent.invites}
                            roleLabel={intl.formatMessage(
                                ROLE_NAME_MESSAGES[sent.role]
                            )}
                            workspaceNames={sent.workspaceNames}
                            copied={copied}
                            onCopied={(id) =>
                                setCopied(
                                    (previous) => new Set([...previous, id])
                                )
                            }
                        />
                        {confirmingMore ? (
                            <Alert
                                variant="destructive"
                                className={CALLOUT_ALERT_CLASS}
                            >
                                <TriangleAlert
                                    aria-hidden
                                    className={CALLOUT_ICON_CLASS}
                                />
                                <AlertDescription>
                                    {intl.formatMessage(messages.uncopied, {
                                        count: uncopied.length
                                    })}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {confirmingMore ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirmingMore(false)}
                                    >
                                        {intl.formatMessage(messages.keepOpen)}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={startOver}
                                    >
                                        {intl.formatMessage(
                                            messages.leaveAnyway
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            uncopied.length > 0
                                                ? setConfirmingMore(true)
                                                : startOver()
                                        }
                                    >
                                        {intl.formatMessage(
                                            messages.inviteMore
                                        )}
                                    </Button>
                                    {/* The app-wide guard asks while a link
                                        is uncopied; this is an ordinary
                                        navigation. */}
                                    <Button onClick={() => navigate('/users')}>
                                        {intl.formatMessage(messages.done)}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </Container>
            </>
        );
    }

    return (
        <>
            {topBar}
            <Container className="max-w-[720px]">
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.description)}
                />
                <Card className="overflow-hidden">
                    <form noValidate onSubmit={submit}>
                        <div className="flex flex-col gap-6 p-6">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor={fieldId}>
                                    {intl.formatMessage(messages.emails)}
                                </Label>
                                <EmailChipsInput
                                    id={fieldId}
                                    emails={emails}
                                    flagged={flagged}
                                    invalid={fieldErrors.length > 0}
                                    describedBy={
                                        fieldErrors.length > 0
                                            ? errorId
                                            : undefined
                                    }
                                    disabled={flow.submitting}
                                    onChange={(next) => {
                                        setEmails(next);
                                        setTriedEmpty(false);
                                    }}
                                />
                                {fieldErrors.length > 0 ? (
                                    <div
                                        id={errorId}
                                        role="alert"
                                        className="flex flex-col gap-1 text-sm text-destructive"
                                    >
                                        {fieldErrors.map((error) => (
                                            <p key={error}>{error}</p>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-col gap-2">
                                <span
                                    id={roleLabelId}
                                    className="text-sm font-medium"
                                >
                                    {intl.formatMessage(messages.role)}
                                </span>
                                <RolePicker
                                    value={role}
                                    labelledBy={roleLabelId}
                                    disabled={flow.submitting}
                                    onChange={setRole}
                                />
                                <p className="text-[13px] text-muted-foreground">
                                    {intl.formatMessage(messages.roleHint)}
                                </p>
                            </div>

                            <div
                                role="group"
                                aria-labelledby={workspacesLabelId}
                                className="flex flex-col gap-2"
                            >
                                <span
                                    id={workspacesLabelId}
                                    className="text-sm font-medium"
                                >
                                    {intl.formatMessage(messages.workspaces)}
                                </span>
                                <InviteWorkspaceTiles
                                    options={options}
                                    loading={workspaces.isPending}
                                    failed={workspaces.isError}
                                    selected={workspaceIds}
                                    disabled={flow.submitting}
                                    onToggle={toggleWorkspace}
                                    onSelectAll={() =>
                                        setWorkspaceIds(
                                            new Set(
                                                options.map(
                                                    (option) => option.id
                                                )
                                            )
                                        )
                                    }
                                    onRetry={() => workspaces.refetch()}
                                />
                            </div>

                            {flow.error === 'failed' ? (
                                <Alert
                                    variant="destructive"
                                    className={CALLOUT_ALERT_CLASS}
                                >
                                    <TriangleAlert
                                        aria-hidden
                                        className={CALLOUT_ICON_CLASS}
                                    />
                                    <AlertDescription>
                                        {intl.formatMessage(messages.failed)}
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-6 py-4">
                            <p className="mr-auto text-[13px] text-muted-foreground">
                                {intl.formatMessage(messages.summary, {
                                    people: emails.length,
                                    role: roleLabel,
                                    workspaces: workspaceIds.size
                                })}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={flow.submitting}
                                onClick={() => navigate('/users')}
                            >
                                {intl.formatMessage(messages.cancel)}
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    flow.submitting ||
                                    flagged.size > 0 ||
                                    (emails.length > 0 && sendable.length === 0)
                                }
                            >
                                {flow.submitting ? (
                                    <>
                                        <Spinner aria-hidden />
                                        <span className="sr-only">
                                            {intl.formatMessage(
                                                messages.sending
                                            )}
                                        </span>
                                    </>
                                ) : (
                                    <Send aria-hidden />
                                )}
                                {intl.formatMessage(messages.send, {
                                    count: sendable.length
                                })}
                            </Button>
                        </div>
                    </form>
                </Card>
            </Container>
        </>
    );
}
