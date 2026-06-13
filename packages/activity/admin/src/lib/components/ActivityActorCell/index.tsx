import { defineMessages, useIntl } from 'react-intl';
import {
    Avatar,
    AvatarFallback,
    AVATAR_COLORS,
    avatarColorVar,
    cn
} from '@ortha-cms/design-system';
import type { ActivityActor } from '../../types/activityEvent';

/** Intl descriptors for {@link ActivityActorCell}, co-located. */
const messages = defineMessages({
    system: {
        id: 'activity.actor.system',
        defaultMessage: 'System'
    },
    unknown: {
        id: 'activity.actor.unknown',
        defaultMessage: 'Unknown'
    }
});

/** Up-to-two-letter uppercase initials from an email's local part. */
function initialsFor(email: string): string {
    const local = email.split('@')[0] ?? email;
    return local
        .split(/[.\-_+]+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/** A stable accent color derived by hashing the actor id into the palette. */
function colorForId(id: string) {
    let hash = 0;
    for (let index = 0; index < id.length; index++) {
        hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash];
}

/**
 * The "Actor" cell: an initials avatar plus the actor's email. A `null` actor
 * (system-initiated event) renders a neutral "System" label with no avatar.
 * The avatar is decorative (`aria-hidden`) — the email beside it carries the
 * meaning.
 */
export function ActivityActorCell({ actor }: { actor: ActivityActor }) {
    const intl = useIntl();

    if (!actor) {
        return (
            <span className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.system)}
            </span>
        );
    }

    const label = actor.email ?? intl.formatMessage(messages.unknown);

    return (
        <div className="flex items-center gap-3">
            <Avatar
                aria-hidden
                className={cn('size-8 shrink-0 rounded-full text-xs')}
                style={{ backgroundColor: avatarColorVar(colorForId(actor.id)) }}
            >
                <AvatarFallback className="rounded-[inherit] bg-transparent font-semibold text-white">
                    {actor.email ? initialsFor(actor.email) : '?'}
                </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{label}</span>
        </div>
    );
}
