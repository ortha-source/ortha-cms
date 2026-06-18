import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@ortha-cms/design-system';
import type { MemberRole } from '../../../types/member';

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
 * The Role column's read-only chip: the member's role as a labelled badge.
 * Changing a role happens through the row's edit action (and the server gates
 * it on `users:update`), so the column itself carries no inline editor.
 */
export function MemberRoleChip({ role }: { role: MemberRole }) {
    const intl = useIntl();

    return (
        <Badge variant="secondary" className="rounded-xl border-border">
            {intl.formatMessage(ROLE_MESSAGE[role])}
        </Badge>
    );
}
