import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Activity,
    Ban,
    Building2,
    CircleCheck,
    LogIn,
    LogOut,
    MailX,
    Pencil,
    Send,
    ShieldCheck,
    UserMinus,
    UserPlus
} from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Skeleton,
    cn
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useActivityLog, type ActivityEvent } from '@ortha-cms/activity-admin';
import { MembersPagination } from '../../components/MembersPagination';
import { useUserDetailContext } from '../../userDetailContext';

/** Default page size for the per-user activity timeline (a pagination option). */
const DEFAULT_PAGE_SIZE = 25;

/** Intl descriptors for {@link UserActivityPage}. */
const messages = defineMessages({
    title: { id: 'users.activity.title', defaultMessage: 'Activity' },
    description: {
        id: 'users.activity.description',
        defaultMessage: 'A timeline of changes to this member’s account.'
    },
    empty: {
        id: 'users.activity.empty',
        defaultMessage: 'No recorded activity yet.'
    },
    error: {
        id: 'users.activity.error',
        defaultMessage: 'Couldn’t load activity. Please try again.'
    },
    retry: { id: 'users.activity.retry', defaultMessage: 'Retry' },
    system: { id: 'users.activity.system', defaultMessage: 'System' },
    by: { id: 'users.activity.by', defaultMessage: 'by {actor}' },
    invited: { id: 'users.activity.invited', defaultMessage: 'Invited' },
    inviteResent: {
        id: 'users.activity.inviteResent',
        defaultMessage: 'Invite resent'
    },
    inviteRevoked: {
        id: 'users.activity.inviteRevoked',
        defaultMessage: 'Invite revoked'
    },
    profileUpdated: {
        id: 'users.activity.profileUpdated',
        defaultMessage: 'Profile updated'
    },
    roleChanged: {
        id: 'users.activity.roleChanged',
        defaultMessage: 'Role changed'
    },
    suspended: {
        id: 'users.activity.suspended',
        defaultMessage: 'Account suspended'
    },
    reactivated: {
        id: 'users.activity.reactivated',
        defaultMessage: 'Account reactivated'
    },
    signedIn: { id: 'users.activity.signedIn', defaultMessage: 'Signed in' },
    signedOut: { id: 'users.activity.signedOut', defaultMessage: 'Signed out' },
    workspaceCreated: {
        id: 'users.activity.workspaceCreated',
        defaultMessage: 'Created a workspace'
    },
    workspaceJoined: {
        id: 'users.activity.workspaceJoined',
        defaultMessage: 'Added to a workspace'
    },
    workspaceLeft: {
        id: 'users.activity.workspaceLeft',
        defaultMessage: 'Removed from a workspace'
    }
});

type ActivityIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

/**
 * Per-kind presentation: a label, an icon, and a tinted icon-chip class. The
 * color and glyph make each action scannable at a glance (an invite reads
 * differently from a suspension). Unknown kinds fall back to a neutral chip.
 */
const KIND_STYLE: Record<
    string,
    {
        label: (typeof messages)[keyof typeof messages];
        icon: ActivityIcon;
        className: string;
    }
> = {
    'user.invited': {
        label: messages.invited,
        icon: UserPlus,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'user.invite_resent': {
        label: messages.inviteResent,
        icon: Send,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'user.invite_revoked': {
        label: messages.inviteRevoked,
        icon: MailX,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'user.profile_updated': {
        label: messages.profileUpdated,
        icon: Pencil,
        className: 'bg-indigo-500/10 text-indigo-600'
    },
    'user.role_changed': {
        label: messages.roleChanged,
        icon: ShieldCheck,
        className: 'bg-violet-500/10 text-violet-600'
    },
    'user.suspended': {
        label: messages.suspended,
        icon: Ban,
        className: 'bg-amber-500/10 text-amber-600'
    },
    'user.reactivated': {
        label: messages.reactivated,
        icon: CircleCheck,
        className: 'bg-emerald-500/10 text-emerald-600'
    },
    'user.signed_in': {
        label: messages.signedIn,
        icon: LogIn,
        className: 'bg-slate-500/10 text-slate-600'
    },
    'user.signed_out': {
        label: messages.signedOut,
        icon: LogOut,
        className: 'bg-slate-500/10 text-slate-600'
    },
    'workspace.created': {
        label: messages.workspaceCreated,
        icon: Building2,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.member_added': {
        label: messages.workspaceJoined,
        icon: UserPlus,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.member_removed': {
        label: messages.workspaceLeft,
        icon: UserMinus,
        className: 'bg-rose-500/10 text-rose-600'
    }
};

const FALLBACK_STYLE = {
    icon: Activity as ActivityIcon,
    className: 'bg-muted text-muted-foreground'
};

/** One timeline entry. */
function ActivityRow({ event }: { event: ActivityEvent }) {
    const intl = useIntl();
    const style = KIND_STYLE[event.kind];
    const title = style ? intl.formatMessage(style.label) : event.kind;
    const Icon = style?.icon ?? FALLBACK_STYLE.icon;
    const chipClassName = style?.className ?? FALLBACK_STYLE.className;
    const actor = event.actor?.email ?? intl.formatMessage(messages.system);

    return (
        <li className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <span
                aria-hidden
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    chipClassName
                )}
            >
                <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                    {intl.formatDate(event.at, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    })}{' '}
                    {intl.formatMessage(messages.by, { actor })}
                </p>
            </div>
        </li>
    );
}

/**
 * The Activity tab: a timeline of audit events whose subject is this member,
 * reusing the activity plugin's `useActivityLog` with a pinned `subjectId`
 * filter. Gated on `activity:read` (the rail hides it otherwise). Paginated
 * with the shared members pagination control.
 */
export function UserActivityPage() {
    const intl = useIntl();
    const { member } = useUserDetailContext();
    const canRead = useHasPermission('activity:read');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // The member's personal log: events *about* them (`subjectType=user` and
    // `subjectId=:id` — e.g. they were added/removed from a workspace, their
    // role changed) OR events they *performed* (`actorId=:id` — e.g. they
    // created a workspace, signed in). Serialised to the wire filter grammar the
    // activity endpoint already parses.
    const filter = useMemo(
        () =>
            JSON.stringify({
                or: [
                    {
                        and: [
                            { field: 'subjectType', op: 'eq', value: 'user' },
                            { field: 'subjectId', op: 'eq', value: member.id }
                        ]
                    },
                    { field: 'actorId', op: 'eq', value: member.id }
                ]
            }),
        [member.id]
    );

    const { data, isPending, isError, refetch } = useActivityLog(
        { filter, page, pageSize },
        canRead
    );

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    const events = data?.items ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isPending ? (
                    <>
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </>
                ) : isError ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{intl.formatMessage(messages.error)}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : events.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <>
                        <ul>
                            {events.map((event) => (
                                <ActivityRow key={event.id} event={event} />
                            ))}
                        </ul>
                        <MembersPagination
                            page={page}
                            pageCount={pageCount}
                            pageSize={effectivePageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={(next) => {
                                setPageSize(next);
                                setPage(1);
                            }}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
