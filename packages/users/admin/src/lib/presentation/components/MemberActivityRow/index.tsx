import type { ComponentType } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Activity,
    Archive,
    ArchiveRestore,
    Ban,
    Building2,
    CircleCheck,
    FileText,
    FolderPlus,
    Image,
    KeyRound,
    LogIn,
    LogOut,
    MailX,
    Pencil,
    Send,
    ShieldCheck,
    Trash2,
    UserMinus,
    UserPlus
} from 'lucide-react';
import { cn } from '@orthacms/design-system';
import {
    formatActivityAction,
    type ActivityEvent
} from '@orthacms/activity-admin';
import { useRecencyFormatter } from '../../recencyLabel';

/** Intl descriptors for the member activity rows, co-located. */
const messages = defineMessages({
    system: { id: 'users.activity.system', defaultMessage: 'System' },
    by: { id: 'users.activity.by', defaultMessage: 'by {actor}' }
});

type ActivityIcon = ComponentType<{
    className?: string;
    'aria-hidden'?: boolean;
}>;

/**
 * Per-kind **presentation** — an icon and a tinted chip class, so an invite
 * reads differently from a suspension at a glance. The *label* is not here on
 * purpose: it comes from `activity-admin`'s `formatActivityAction`, the one
 * kind→label catalogue in the admin.
 *
 * This map used to own labels too, and it knew twelve kinds. The tab's query is
 * "everything about *or by* this member", so it surfaces every kind the actor
 * touched — and each of the other nineteen rendered as a raw dotted wire token
 * (`media.asset.uploaded`, `token.created`, `workspace.content_granted`) in a
 * member's timeline. A second catalogue is a second thing to forget; a missing
 * icon here only costs a neutral chip.
 */
const KIND_STYLE: Record<string, { icon: ActivityIcon; className: string }> = {
    'user.invited': {
        icon: UserPlus,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'user.invite_resent': {
        icon: Send,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'user.invite_revoked': {
        icon: MailX,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'user.activated': {
        icon: CircleCheck,
        className: 'bg-emerald-500/10 text-emerald-600'
    },
    'user.profile_updated': {
        icon: Pencil,
        className: 'bg-indigo-500/10 text-indigo-600'
    },
    'user.role_changed': {
        icon: ShieldCheck,
        className: 'bg-violet-500/10 text-violet-600'
    },
    'user.suspended': {
        icon: Ban,
        className: 'bg-amber-500/10 text-amber-600'
    },
    'user.reactivated': {
        icon: CircleCheck,
        className: 'bg-emerald-500/10 text-emerald-600'
    },
    'user.password_changed': {
        icon: KeyRound,
        className: 'bg-violet-500/10 text-violet-600'
    },
    'user.password_reset_issued': {
        icon: KeyRound,
        className: 'bg-amber-500/10 text-amber-600'
    },
    'user.signed_in': {
        icon: LogIn,
        className: 'bg-slate-500/10 text-slate-600'
    },
    'user.signed_out': {
        icon: LogOut,
        className: 'bg-slate-500/10 text-slate-600'
    },
    'workspace.created': {
        icon: Building2,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.updated': {
        icon: Pencil,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.archived': {
        icon: Archive,
        className: 'bg-amber-500/10 text-amber-600'
    },
    'workspace.unarchived': {
        icon: ArchiveRestore,
        className: 'bg-emerald-500/10 text-emerald-600'
    },
    'workspace.deleted': {
        icon: Trash2,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'workspace.member_added': {
        icon: UserPlus,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.member_removed': {
        icon: UserMinus,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'workspace.content_granted': {
        icon: ShieldCheck,
        className: 'bg-teal-500/10 text-teal-600'
    },
    'workspace.content_revoked': {
        icon: ShieldCheck,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'entry.published': {
        icon: FileText,
        className: 'bg-emerald-500/10 text-emerald-600'
    },
    'entry.unpublished': {
        icon: FileText,
        className: 'bg-amber-500/10 text-amber-600'
    },
    'token.created': {
        icon: KeyRound,
        className: 'bg-violet-500/10 text-violet-600'
    },
    'token.revoked': {
        icon: KeyRound,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'media.asset.uploaded': {
        icon: Image,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'media.asset.updated': {
        icon: Pencil,
        className: 'bg-indigo-500/10 text-indigo-600'
    },
    'media.asset.moved': {
        icon: FolderPlus,
        className: 'bg-indigo-500/10 text-indigo-600'
    },
    'media.asset.deleted': {
        icon: Trash2,
        className: 'bg-rose-500/10 text-rose-600'
    },
    'media.folder.created': {
        icon: FolderPlus,
        className: 'bg-blue-500/10 text-blue-600'
    },
    'media.folder.renamed': {
        icon: Pencil,
        className: 'bg-indigo-500/10 text-indigo-600'
    },
    'media.folder.deleted': {
        icon: Trash2,
        className: 'bg-rose-500/10 text-rose-600'
    }
};

const FALLBACK_STYLE = {
    icon: Activity as ActivityIcon,
    className: 'bg-muted text-muted-foreground'
};

/** The name of what an event was about, when its metadata carries one. */
function subjectTitleOf(event: ActivityEvent): string | null {
    const meta = event.meta ?? {};
    for (const key of ['title', 'name', 'label']) {
        const value = meta[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

/** The tinted icon chip for an event's kind. */
function KindChip({ kind, compact }: { kind: string; compact?: boolean }) {
    const style = KIND_STYLE[kind];
    const Icon = style?.icon ?? FALLBACK_STYLE.icon;
    return (
        <span
            aria-hidden
            className={cn(
                'flex shrink-0 items-center justify-center',
                compact ? 'size-6 rounded-md' : 'size-8 rounded-full',
                style?.className ?? FALLBACK_STYLE.className
            )}
        >
            <Icon aria-hidden className={compact ? 'size-3.5' : 'size-4'} />
        </span>
    );
}

/**
 * One entry of a member's activity timeline (the Activity tab): what happened,
 * when, and by whom. The *label* comes from `activity-admin`'s
 * `formatActivityAction`, the one kind→label catalogue in the admin; only the
 * icon and its tint are decided here, so a kind this map does not know costs a
 * neutral chip, never a raw wire token.
 */
export function MemberActivityRow({ event }: { event: ActivityEvent }) {
    const intl = useIntl();
    const title = formatActivityAction(intl, event.kind);
    const actor = event.actor?.email ?? intl.formatMessage(messages.system);

    return (
        <li className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <KindChip kind={event.kind} />
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
 * The Overview card's short form of the same entry: the action, the name of
 * what it was about when the event carries one ("Published **Spring
 * launch**"), and how long ago.
 */
export function MemberActivityLine({ event }: { event: ActivityEvent }) {
    const intl = useIntl();
    const formatRecency = useRecencyFormatter();
    const title = formatActivityAction(intl, event.kind);
    const subject = subjectTitleOf(event);

    return (
        <li className="flex min-h-12 items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
            <KindChip kind={event.kind} compact />
            <span className="min-w-0 flex-1 truncate">
                {title}
                {subject ? (
                    <>
                        {' '}
                        <span className="font-medium">{subject}</span>
                    </>
                ) : null}
            </span>
            <span className="shrink-0 text-[13px] text-muted-foreground">
                {formatRecency(event.at)}
            </span>
        </li>
    );
}
