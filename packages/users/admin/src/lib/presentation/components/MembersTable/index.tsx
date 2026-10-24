import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useAuth } from '@orthacms/identity-admin';
import {
    Badge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import { MemberAvatar } from '../MemberAvatar';
import { MemberRoleChip } from './MemberRoleChip';
import { MemberRowActions } from './MemberRowActions';
import { MemberStatusBadge } from './MemberStatusBadge';
import { MemberWorkspaces } from './MemberWorkspaces';
import type { Member } from '../../../domain/types/member';
import { useRecencyFormatter } from '../../recencyLabel';

/** Intl descriptors for {@link MembersTable}, co-located with the component. */
const messages = defineMessages({
    member: {
        id: 'users.table.member',
        defaultMessage: 'Member'
    },
    role: {
        id: 'users.table.role',
        defaultMessage: 'Role'
    },
    status: {
        id: 'users.table.status',
        defaultMessage: 'Status'
    },
    workspaces: {
        id: 'users.table.workspaces',
        defaultMessage: 'Workspaces'
    },
    lastActive: {
        id: 'users.table.lastActive',
        defaultMessage: 'Last active'
    },
    never: {
        id: 'users.table.neverSignedIn',
        defaultMessage: 'Never signed in'
    },
    you: {
        id: 'users.table.you',
        defaultMessage: 'You'
    },
    actions: {
        id: 'users.table.actions',
        defaultMessage: 'Actions'
    },
    caption: {
        id: 'users.table.caption',
        defaultMessage: 'Members'
    }
});

/**
 * The members table: avatar + name + email (with a "You" badge on your own
 * row), the role badge, the workspace tiles, the status badge, **when they
 * were last active** (for an invite, when it was sent), and the row's actions
 * — an invited row offers Resend right there; everything else is in the
 * kebab. The whole row is a shortcut to the member's page (the name is a real
 * link for keyboard users); the actions cell stops the click from bubbling so
 * opening the menu doesn't also navigate.
 */
export function MembersTable({
    members,
    stale = false
}: {
    members: Member[];
    /**
     * The rows are the previous page/search's result while the next one loads
     * (`isPlaceholderData`) — the table dims its body and goes `aria-busy`.
     */
    stale?: boolean;
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    const { user } = useAuth();
    const formatRecency = useRecencyFormatter();

    /** The Last active cell: the invite date for an invite, else the last seen. */
    const lastActive = (member: Member): string => {
        if (member.status === 'pending') {
            return formatRecency(member.joinedAt, 'invited');
        }
        return member.lastActiveAt
            ? formatRecency(member.lastActiveAt)
            : intl.formatMessage(messages.never);
    };

    return (
        <Table aria-label={intl.formatMessage(messages.caption)} stale={stale}>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.member)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.role)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.workspaces)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.status)}
                    </TableHead>
                    <TableHead scope="col">
                        {intl.formatMessage(messages.lastActive)}
                    </TableHead>
                    <TableHead scope="col" className="w-28">
                        <span className="sr-only">
                            {intl.formatMessage(messages.actions)}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {members.map((member) => (
                    <TableRow
                        key={member.id}
                        onClick={() => navigate(`/users/${member.id}`)}
                        className="cursor-pointer"
                    >
                        <TableCell>
                            <div className="flex items-center gap-2.5">
                                <MemberAvatar
                                    initials={member.initials}
                                    color={member.color}
                                    className="size-7 shrink-0 rounded-full text-[10px]"
                                />
                                {/* `max-w-*`, not just `min-w-0`: the cell
                                auto-sizes to its content, so a very long
                                display name widens the column and pushes the
                                row's kebab off-screen. Capping the block is
                                what actually lets `truncate` engage. */}
                                <div className="min-w-0 max-w-[18rem]">
                                    <Link
                                        to={`/users/${member.id}`}
                                        className="block truncate text-sm font-medium hover:underline"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        {member.name}
                                    </Link>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {member.email}
                                    </p>
                                </div>
                                {user?.id === member.id ? (
                                    <Badge size="xs" variant="muted">
                                        {intl.formatMessage(messages.you)}
                                    </Badge>
                                ) : null}
                            </div>
                        </TableCell>
                        <TableCell>
                            <MemberRoleChip
                                role={member.role}
                                roleName={member.roleName}
                            />
                        </TableCell>
                        <TableCell>
                            <MemberWorkspaces workspaces={member.workspaces} />
                        </TableCell>
                        <TableCell>
                            <MemberStatusBadge status={member.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {lastActive(member)}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <MemberRowActions member={member} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
