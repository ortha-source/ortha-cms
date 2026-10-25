import { Settings } from 'lucide-react';
import {
    Avatar,
    AvatarFallback,
    avatarColorVar,
    cn
} from '@orthacms/design-system';
import { avatarColorForId, initialsFromEmail } from '@orthacms/utils-admin';
import type { ActivityActor } from '../../../types/activityEvent';

/**
 * The actor's initials on their stable colour, or a neutral gear for a
 * system event (no actor). Decorative: every place it appears also names the
 * actor in text, so it is hidden from assistive tech.
 */
export function ActivityActorAvatar({
    actor,
    className
}: {
    actor: ActivityActor;
    className?: string;
}) {
    if (!actor) {
        return (
            <span
                aria-hidden
                className={cn(
                    'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
                    className
                )}
            >
                <Settings className="size-3.5" />
            </span>
        );
    }
    return (
        <Avatar
            aria-hidden
            className={cn('size-6 shrink-0 text-[9px]', className)}
            style={{
                backgroundColor: avatarColorVar(avatarColorForId(actor.id))
            }}
        >
            <AvatarFallback className="rounded-[inherit] bg-transparent font-semibold text-white">
                {actor.email ? initialsFromEmail(actor.email) : '?'}
            </AvatarFallback>
        </Avatar>
    );
}
