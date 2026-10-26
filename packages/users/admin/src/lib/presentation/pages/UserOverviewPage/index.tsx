import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { KeyRound, Laptop, Plus } from 'lucide-react';
import {
    Button,
    InputField,
    Skeleton,
    Spinner,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { useActivityLog } from '@orthacms/activity-admin';
import { useUpdateMember } from '../../../application/useUpdateMember';
import { useUserSessions } from '../../../application/useUserSessions';
import { useMemberSignIn } from '../../../application/useMemberSignIn';
import { useAddToWorkspaces } from '../../../application/useAddToWorkspaces';
import type { Member } from '../../../domain/types/member';
import { AddToWorkspacesDialog } from '../../components/AddToWorkspacesDialog';
import { MemberActivityLine } from '../../components/MemberActivityRow';
import { MemberAvatar } from '../../components/MemberAvatar';
import { MemberCard, MemberCardRow } from '../../components/MemberCard';
import { memberActivityFilter } from '../../memberActivityFilter';
import { useUserDetailContext } from '../../userDetailContext';

/** Server-side cap on the display name (mirrors the users plugin). */
const NAME_MAX_LENGTH = 80;

/** How many events the Recent activity card shows before "See all". */
const RECENT_EVENTS = 3;

/** How many workspaces the Workspaces card lists before "See all N". */
const SUMMARY_WORKSPACES = 5;

/** Everyday names for the SSO providers Ortha ships adapters for. */
const SSO_NAMES: Record<string, string> = {
    google: 'Google',
    entra: 'Microsoft Entra',
    okta: 'Okta',
    oidc: 'OpenID Connect',
    saml: 'SAML'
};

/** Intl descriptors for {@link UserOverviewPage}, co-located with the page. */
const messages = defineMessages({
    profile: { id: 'users.overview.profile', defaultMessage: 'Profile' },
    nameLabel: { id: 'users.general.nameLabel', defaultMessage: 'Full name' },
    nameTooLong: {
        id: 'users.general.nameTooLong',
        defaultMessage: 'Keep the name under {max} characters.'
    },
    emailLabel: { id: 'users.general.emailLabel', defaultMessage: 'Email' },
    emailHint: {
        id: 'users.general.emailHint',
        defaultMessage: 'The sign-in identifier. It can’t be changed here.'
    },
    save: { id: 'users.general.save', defaultMessage: 'Save changes' },
    discard: { id: 'users.general.discard', defaultMessage: 'Discard' },
    saved: {
        id: 'users.general.saved',
        defaultMessage: 'Saved changes to {name}.'
    },
    saveFailed: {
        id: 'users.general.failed',
        defaultMessage: 'Couldn’t save the changes. Please try again.'
    },
    recentActivity: {
        id: 'users.overview.recentActivity',
        defaultMessage: 'Recent activity'
    },
    seeAll: { id: 'users.overview.seeAll', defaultMessage: 'See all' },
    seeAllLabel: {
        id: 'users.overview.seeAllLabel',
        defaultMessage: 'See all of {name}’s activity'
    },
    noActivity: {
        id: 'users.overview.noActivity',
        defaultMessage: 'No recorded activity yet.'
    },
    activityFailed: {
        id: 'users.overview.activityFailed',
        defaultMessage: 'Couldn’t load recent activity.'
    },
    workspaces: {
        id: 'users.overview.workspaces',
        defaultMessage: 'Workspaces'
    },
    add: { id: 'users.overview.addWorkspace', defaultMessage: 'Add' },
    addLabel: {
        id: 'users.overview.addWorkspaceLabel',
        defaultMessage: 'Add {name} to workspaces'
    },
    seeAllWorkspaces: {
        id: 'users.overview.seeAllWorkspaces',
        defaultMessage: 'See all {count}'
    },
    seeAllWorkspacesLabel: {
        id: 'users.overview.seeAllWorkspacesLabel',
        defaultMessage: 'See all {count} of {name}’s workspaces'
    },
    noWorkspaces: {
        id: 'users.overview.noWorkspaces',
        defaultMessage: 'Not in any workspace yet.'
    },
    added: {
        id: 'users.workspaces.added',
        defaultMessage:
            'Added to {count, plural, one {# workspace} other {# workspaces}}.'
    },
    addFailed: {
        id: 'users.workspaces.addFailed',
        defaultMessage: 'Couldn’t add to the workspaces. Please try again.'
    },
    signIn: { id: 'users.overview.signIn', defaultMessage: 'Sign-in' },
    sessions: {
        id: 'users.overview.sessions',
        defaultMessage:
            '{count, plural, =0 {No active sessions} one {# active session} other {# active sessions}}'
    },
    sessionsFailed: {
        id: 'users.overview.sessionsFailed',
        defaultMessage: 'Couldn’t load sessions.'
    },
    manage: { id: 'users.overview.manage', defaultMessage: 'Manage' },
    manageLabel: {
        id: 'users.overview.manageLabel',
        defaultMessage: 'Manage {name}’s sessions and access'
    },
    passwordSet: {
        id: 'users.overview.passwordSet',
        defaultMessage: 'Password set'
    },
    noPassword: {
        id: 'users.overview.noPassword',
        defaultMessage: 'No password'
    },
    sso: { id: 'users.overview.sso', defaultMessage: 'SSO: {providers}' },
    invitePending: {
        id: 'users.overview.invitePending',
        defaultMessage: 'Invite not accepted yet — no way to sign in so far.'
    }
});

/**
 * The member page's **Overview**: the profile on the left (name, editable;
 * email, fixed) over their recent activity, and on the right a summary card
 * each for their workspaces and how they sign in — every summary with a way
 * into the full tab ("See all", "Manage") or the action it is about ("Add").
 *
 * Each card is gated like the tab it summarises: recent activity on
 * `activity:read`, sign-in on `users:update` (session rows and sign-in methods
 * are account-security data, not directory data). The profile's name is
 * editable with `users:update`, read-only otherwise.
 */
export function UserOverviewPage() {
    const { member } = useUserDetailContext();
    const canManage = useHasPermission('users:update');
    const canReadActivity = useHasPermission('activity:read');

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
                <ProfileCard member={member} canManage={canManage} />
                {canReadActivity ? (
                    <RecentActivityCard member={member} />
                ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
                <WorkspacesCard member={member} canManage={canManage} />
                {canManage ? <SignInCard member={member} /> : null}
            </div>
        </div>
    );
}

/** Name (editable with `users:update`) and email (the sign-in identifier, fixed). */
function ProfileCard({
    member,
    canManage
}: {
    member: Member;
    canManage: boolean;
}) {
    const intl = useIntl();
    const update = useUpdateMember();
    const [name, setName] = useState(member.name);
    const trimmed = name.trim();
    const tooLong = trimmed.length > NAME_MAX_LENGTH;
    const dirty = trimmed !== member.name.trim();
    const canSave = canManage && dirty && trimmed.length > 0 && !tooLong;

    const save = () => {
        if (!canSave) {
            return;
        }
        update.mutate(
            { id: member.id, name: trimmed },
            {
                onSuccess: (saved) => {
                    setName(saved.name);
                    toast.success(
                        intl.formatMessage(messages.saved, { name: saved.name })
                    );
                },
                onError: () => {
                    toast.error(intl.formatMessage(messages.saveFailed));
                }
            }
        );
    };

    return (
        <MemberCard title={intl.formatMessage(messages.profile)}>
            <form
                className="flex flex-col gap-4 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <InputField
                    id="user-general-name"
                    label={intl.formatMessage(messages.nameLabel)}
                    value={name}
                    maxLength={NAME_MAX_LENGTH + 1}
                    disabled={!canManage || update.isPending}
                    onChange={(event) => setName(event.target.value)}
                    error={
                        tooLong
                            ? intl.formatMessage(messages.nameTooLong, {
                                  max: NAME_MAX_LENGTH
                              })
                            : undefined
                    }
                />
                <InputField
                    id="user-general-email"
                    label={intl.formatMessage(messages.emailLabel)}
                    value={member.email}
                    description={intl.formatMessage(messages.emailHint)}
                    readOnly
                    disabled
                />
                {canManage && dirty ? (
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setName(member.name)}
                            disabled={update.isPending}
                        >
                            {intl.formatMessage(messages.discard)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canSave || update.isPending}
                        >
                            {update.isPending ? <Spinner /> : null}
                            {intl.formatMessage(messages.save)}
                        </Button>
                    </div>
                ) : null}
            </form>
        </MemberCard>
    );
}

/** The last few things this member did or had done to them. */
function RecentActivityCard({ member }: { member: Member }) {
    const intl = useIntl();
    const filter = useMemo(() => memberActivityFilter(member.id), [member.id]);
    const { data, isPending, isError } = useActivityLog(
        { filter, page: 1, pageSize: RECENT_EVENTS },
        true
    );
    const events = data?.items ?? [];

    return (
        <MemberCard
            title={intl.formatMessage(messages.recentActivity)}
            action={
                <Link
                    to={`/users/${member.id}/activity`}
                    aria-label={intl.formatMessage(messages.seeAllLabel, {
                        name: member.name
                    })}
                    className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {intl.formatMessage(messages.seeAll)}
                </Link>
            }
        >
            {isPending ? (
                <div className="flex flex-col gap-2 p-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-2/3" />
                </div>
            ) : isError ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.activityFailed)}
                </p>
            ) : events.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noActivity)}
                </p>
            ) : (
                <ul>
                    {events.slice(0, RECENT_EVENTS).map((event) => (
                        <MemberActivityLine key={event.id} event={event} />
                    ))}
                </ul>
            )}
        </MemberCard>
    );
}

/** The member's workspaces, with "Add" for someone who may change them. */
function WorkspacesCard({
    member,
    canManage
}: {
    member: Member;
    canManage: boolean;
}) {
    const intl = useIntl();
    const addMember = useAddToWorkspaces(member.id);
    const [adding, setAdding] = useState(false);

    const onAdd = async (workspaceIds: string[]) => {
        const { added, failed } = await addMember.add(workspaceIds);
        if (added > 0) {
            setAdding(false);
            toast.success(intl.formatMessage(messages.added, { count: added }));
        }
        if (failed > 0) {
            toast.error(intl.formatMessage(messages.addFailed));
        }
    };

    return (
        <MemberCard
            title={intl.formatMessage(messages.workspaces)}
            count={member.workspaces.length}
            action={
                canManage ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label={intl.formatMessage(messages.addLabel, {
                            name: member.name
                        })}
                        onClick={() => setAdding(true)}
                    >
                        <Plus aria-hidden />
                        {intl.formatMessage(messages.add)}
                    </Button>
                ) : null
            }
        >
            {member.workspaces.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.noWorkspaces)}
                </p>
            ) : (
                <ul>
                    {member.workspaces
                        .slice(0, SUMMARY_WORKSPACES)
                        .map((workspace) => (
                            <li
                                key={workspace.id}
                                className="flex min-h-12 items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
                            >
                                <MemberAvatar
                                    initials={workspace.initials}
                                    color={workspace.color}
                                    className="size-6 shrink-0 rounded-md text-[10px]"
                                />
                                <span className="truncate">
                                    {workspace.name}
                                </span>
                            </li>
                        ))}
                    {member.workspaces.length > SUMMARY_WORKSPACES ? (
                        <li className="flex min-h-11 items-center px-4 py-2.5">
                            <Link
                                to={`/users/${member.id}/workspaces`}
                                aria-label={intl.formatMessage(
                                    messages.seeAllWorkspacesLabel,
                                    {
                                        count: member.workspaces.length,
                                        name: member.name
                                    }
                                )}
                                className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {intl.formatMessage(messages.seeAllWorkspaces, {
                                    count: member.workspaces.length
                                })}
                            </Link>
                        </li>
                    ) : null}
                </ul>
            )}
            {canManage ? (
                <AddToWorkspacesDialog
                    open={adding}
                    onOpenChange={setAdding}
                    existingIds={member.workspaces.map((ws) => ws.id)}
                    busy={addMember.isPending}
                    onAdd={onAdd}
                />
            ) : null}
        </MemberCard>
    );
}

/** How many sessions are open, and how the member signs in. */
function SignInCard({ member }: { member: Member }) {
    const intl = useIntl();
    const pending = member.status === 'pending';
    const sessions = useUserSessions(member.id, !pending);
    const signIn = useMemberSignIn(member.id, !pending);

    const methods = (() => {
        if (!signIn.data) {
            return null;
        }
        const parts = [
            intl.formatMessage(
                signIn.data.hasPassword
                    ? messages.passwordSet
                    : messages.noPassword
            )
        ];
        if (signIn.data.ssoProviders.length > 0) {
            parts.push(
                intl.formatMessage(messages.sso, {
                    providers: intl.formatList(
                        signIn.data.ssoProviders.map(
                            (key) =>
                                SSO_NAMES[key] ??
                                key.charAt(0).toUpperCase() + key.slice(1)
                        )
                    )
                })
            );
        }
        return parts.join(' · ');
    })();

    return (
        <MemberCard title={intl.formatMessage(messages.signIn)}>
            {pending ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                    {intl.formatMessage(messages.invitePending)}
                </p>
            ) : (
                <>
                    <MemberCardRow>
                        <Laptop
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1">
                            {sessions.isPending ? (
                                <Skeleton className="h-4 w-32" />
                            ) : sessions.isError ? (
                                intl.formatMessage(messages.sessionsFailed)
                            ) : (
                                intl.formatMessage(messages.sessions, {
                                    count: sessions.data.length
                                })
                            )}
                        </span>
                        <Link
                            to={`/users/${member.id}/access`}
                            aria-label={intl.formatMessage(
                                messages.manageLabel,
                                { name: member.name }
                            )}
                            className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {intl.formatMessage(messages.manage)}
                        </Link>
                    </MemberCardRow>
                    <MemberCardRow>
                        <KeyRound
                            aria-hidden
                            className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1">
                            {signIn.isPending ? (
                                <Skeleton className="h-4 w-40" />
                            ) : (
                                (methods ?? '—')
                            )}
                        </span>
                    </MemberCardRow>
                </>
            )}
        </MemberCard>
    );
}
