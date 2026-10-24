import {
    Activity,
    Check,
    FileText,
    KeyRound,
    LogIn,
    LogOut,
    Mail,
    Pencil,
    RefreshCw,
    ShieldAlert,
    Trash2,
    Upload,
    Users,
    type LucideIcon
} from 'lucide-react';
import { cn } from '@orthacms/design-system';
import { activityTone, type ActivityTone } from '../../activitySentence';

/** The tile's surface per tone — the design system's soft tints. */
const TONE_CLASSES: Record<ActivityTone, string> = {
    success: 'bg-success-soft text-success-soft-foreground',
    info: 'bg-info-soft text-info-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    danger: 'bg-destructive-soft text-destructive-soft-foreground',
    muted: 'bg-muted text-muted-foreground'
};

/** The glyph for a kind: the verb first, then the domain, then a generic one. */
function iconFor(kind: string): LucideIcon {
    const verb = kind.slice(kind.lastIndexOf('.') + 1);
    if (kind === 'user.signed_in') return LogIn;
    if (kind === 'user.signed_out') return LogOut;
    if (kind === 'user.sign_in_failed') return ShieldAlert;
    if (kind === 'outbox.event_retried') return RefreshCw;
    if (kind.startsWith('token.')) return KeyRound;
    if (
        /^(invited|invite_resent|invite_revoked|password_reset_issued|invite_link_revealed)$/.test(
            verb
        )
    )
        return Mail;
    if (kind.startsWith('user.') || kind.startsWith('workspace.member'))
        return Users;
    if (/^(deleted|purged|revoked|content_revoked)$/.test(verb)) return Trash2;
    if (
        /^(published|approved|restored|unarchived|activated|reactivated)$/.test(
            verb
        )
    )
        return Check;
    if (/^(uploaded|imported)$/.test(verb)) return Upload;
    if (
        /^(updated|renamed|moved|rule_changed|entry_access_changed)$/.test(verb)
    )
        return Pencil;
    if (/^(created)$/.test(verb)) return FileText;
    return Activity;
}

/**
 * The small tinted square that leads a feed row and the event panel's title:
 * the kind's glyph on its tone's soft surface. Decorative — the sentence beside
 * it says the same thing in words — so it is hidden from assistive tech.
 */
export function ActivityActionTile({
    kind,
    className
}: {
    kind: string;
    className?: string;
}) {
    const Icon = iconFor(kind);
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex size-6 shrink-0 items-center justify-center rounded-md',
                TONE_CLASSES[activityTone(kind)],
                className
            )}
        >
            <Icon className="size-3.5" />
        </span>
    );
}
