import { useId, useState, type FormEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Send, TriangleAlert } from 'lucide-react';
import { useHasPermission } from '@orthacms/identity-admin';
import { useUnsavedChanges } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Label,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
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
import { RolePicker, ROLE_NAME_MESSAGES } from '../RolePicker';
import { EmailChipsInput } from './EmailChipsInput';
import { InviteMembersSent } from './InviteMembersSent';
import { WorkspaceTiles } from './WorkspaceTiles';

/** Intl descriptors for {@link InviteMembersSheet}, co-located. */
const messages = defineMessages({
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
    },
    close: { id: 'users.inviteSheet.close', defaultMessage: 'Close' }
});

/** The finished batch, frozen as it was sent. */
type SentBatch = {
    invites: SentInvite[];
    role: MemberRole;
    workspaceNames: string[];
};

/** Where an uncopied-links guard was raised from. */
type Leaving = 'close' | 'more' | null;

/**
 * **Invite people**, from one sheet: addresses as chips (several at once —
 * paste a list), one role as cards, workspaces as tiles, and a button that
 * says how many invites go out. Mounted by the members page only while open,
 * so every opening starts clean.
 *
 * **Problems are flagged at the address.** A malformed address, or one that
 * already belongs to a member, turns its chip red with the reason under the
 * field, and Send stays off until it is removed: the batch is all-or-nothing
 * server-side, so sending around a bad chip would only fail. The "already a
 * member" check reads the ordinary member list as the admin types
 * (`useExistingEmails`); the server's `409` naming addresses stays the
 * authority and lands in the same place.
 *
 * **Then a link per person.** With no mailer every invite's link is shown once
 * with its own Copy, and leaving — Done, Invite more, Esc, the close button,
 * or navigating away — asks first while any link has not been copied, because
 * none of them can be shown again. With a mailer it is one line: who was sent
 * an email.
 */
export function InviteMembersSheet({ onClose }: { onClose: () => void }) {
    const intl = useIntl();
    const canRead = useHasPermission('users:read');
    const flow = useInviteMembersFlow();
    const workspaces = useWorkspaceOptions(true);

    const [emails, setEmails] = useState<string[]>([]);
    const [role, setRole] = useState<MemberRole>('contributor');
    const [workspaceIds, setWorkspaceIds] = useState<Set<string>>(new Set());
    const [triedEmpty, setTriedEmpty] = useState(false);
    const [sent, setSent] = useState<SentBatch | null>(null);
    const [copied, setCopied] = useState<Set<string>>(new Set());
    const [leaving, setLeaving] = useState<Leaving>(null);

    const fieldId = useId();
    const errorId = useId();
    const roleLabelId = useId();
    const workspacesLabelId = useId();

    const existing = useExistingEmails(emails, canRead && sent === null);

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
    const uncopied =
        sent?.invites.filter(
            (invite) => invite.link !== null && !copied.has(invite.id)
        ) ?? [];

    // The links exist only in this component's state. Leaving by any route
    // the sheet cannot intercept itself — a link, a reload — asks first.
    useUnsavedChanges(uncopied.length > 0, 'users.invite.links');

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

    const startOver = () => {
        flow.reset();
        setSent(null);
        setEmails([]);
        setTriedEmpty(false);
        setLeaving(null);
    };

    /** Every way out of the sent step funnels here, so none slips past the guard. */
    const requestLeave = (to: Exclude<Leaving, null>) => {
        if (uncopied.length > 0 && leaving === null) {
            setLeaving(to);
            return;
        }
        leave(to);
    };
    const leave = (to: Exclude<Leaving, null>) => {
        setLeaving(null);
        if (to === 'more') {
            startOver();
        } else {
            onClose();
        }
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

    return (
        <Sheet
            open
            onOpenChange={(open) => {
                if (open || flow.submitting) {
                    return;
                }
                if (sent) {
                    requestLeave('close');
                } else {
                    onClose();
                }
            }}
        >
            <SheetContent
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
                closeLabel={intl.formatMessage(messages.close)}
            >
                {sent ? (
                    <>
                        <SheetHeader className="gap-1.5 border-b px-6 pb-4 pt-6">
                            <div className="flex items-center gap-2.5 pr-8">
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground"
                                >
                                    <Check className="size-4" />
                                </span>
                                <SheetTitle>
                                    {intl.formatMessage(messages.sentTitle, {
                                        count: sent.invites.length
                                    })}
                                </SheetTitle>
                            </div>
                            <SheetDescription>
                                {mailed
                                    ? intl.formatMessage(messages.sentMailed, {
                                          count: sent.invites.length
                                      })
                                    : intl.formatMessage(messages.sentLinks, {
                                          days: expiresInDays
                                      })}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
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
                            {leaving ? (
                                <Alert variant="destructive">
                                    <TriangleAlert aria-hidden />
                                    <AlertDescription>
                                        {intl.formatMessage(messages.uncopied, {
                                            count: uncopied.length
                                        })}
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                        </div>
                        <SheetFooter className="items-center border-t px-6 py-4 sm:justify-between">
                            {leaving ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => setLeaving(null)}
                                    >
                                        {intl.formatMessage(messages.keepOpen)}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => leave(leaving)}
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
                                        onClick={() => requestLeave('more')}
                                    >
                                        {intl.formatMessage(
                                            messages.inviteMore
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => requestLeave('close')}
                                    >
                                        {intl.formatMessage(messages.done)}
                                    </Button>
                                </>
                            )}
                        </SheetFooter>
                    </>
                ) : (
                    <form
                        noValidate
                        onSubmit={submit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <SheetHeader className="gap-1 border-b px-6 pb-4 pt-6">
                            <SheetTitle className="pr-8">
                                {intl.formatMessage(messages.title)}
                            </SheetTitle>
                            <SheetDescription>
                                {intl.formatMessage(messages.description)}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
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
                                <WorkspaceTiles
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
                                <Alert variant="destructive">
                                    <TriangleAlert aria-hidden />
                                    <AlertDescription>
                                        {intl.formatMessage(messages.failed)}
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                        </div>
                        <SheetFooter className="items-center gap-2 border-t px-6 py-4">
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
                                onClick={onClose}
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
                        </SheetFooter>
                    </form>
                )}
            </SheetContent>
        </Sheet>
    );
}
