import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';
import type { MemberRole } from '../../../../domain/types/member';

/** Intl descriptors for {@link MemberRoleChip}, co-located with the component. */
const messages = defineMessages({
    admin: {
        id: 'users.role.admin',
        defaultMessage: 'Admin'
    },
    contributor: {
        id: 'users.role.contributor',
        defaultMessage: 'Contributor'
    },
    viewer: {
        id: 'users.role.viewer',
        defaultMessage: 'Viewer'
    }
});

const ROLE_MESSAGE: Record<
    MemberRole,
    (typeof messages)[keyof typeof messages]
> = {
    admin: messages.admin,
    contributor: messages.contributor,
    viewer: messages.viewer
};

/**
 * Tone per role, loudest first: an admin is the one worth noticing in a list
 * of people, so it takes the tinted chip; a contributor gets a hairline; a
 * viewer — who changes nothing — the quietest.
 */
const ROLE_VARIANT = {
    admin: 'info',
    contributor: 'line',
    viewer: 'muted'
} as const;

/**
 * A member's role as a small read-only badge — the roster's Role column and
 * the member page's header. Changing it happens through the role dialog (and
 * the server gates it on `users:update`), so the chip itself is never a
 * control.
 *
 * A member holding a **custom** role has `role: null`; the chip then shows the
 * server's own `roleName` rather than a guessed system role, so it never
 * misstates someone's privileges.
 */
export function MemberRoleChip({
    role,
    roleName
}: {
    /** The member's system role, or `null` for a custom one. */
    role: MemberRole | null;
    /** The server's label, shown verbatim when `role` is `null`. */
    roleName: string;
}) {
    const intl = useIntl();

    return (
        <Badge size="xs" variant={role === null ? 'line' : ROLE_VARIANT[role]}>
            {role === null ? roleName : intl.formatMessage(ROLE_MESSAGE[role])}
        </Badge>
    );
}
