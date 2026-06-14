import { defineMessages, useIntl } from 'react-intl';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { MemberRoleChip } from './MemberRoleChip';
import { MemberRowActions } from './MemberRowActions';
import { MemberStatusBadge } from './MemberStatusBadge';
import { MemberWorkspaces } from './MemberWorkspaces';
import type { Member } from '../../../types/member';

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
    joined: {
        id: 'users.table.joined',
        defaultMessage: 'Joined'
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
 * The members table: avatar + name + email, an inline role editor, the
 * status pill, the workspace stack, the joined date (the invite date for
 * Invited rows), and the per-row actions menu.
 */
export function MembersTable({
    members,
    onEdit
}: {
    members: Member[];
    /** Opens the edit dialog for a member (from the row menu). */
    onEdit: (member: Member) => void;
}) {
    const intl = useIntl();

    return (
        <div className="rounded-xl border">
            <Table aria-label={intl.formatMessage(messages.caption)}>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            {intl.formatMessage(messages.member)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.role)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.status)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.workspaces)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.joined)}
                        </TableHead>
                        <TableHead className="w-12">
                            <span className="sr-only">
                                {intl.formatMessage(messages.actions)}
                            </span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => (
                        <TableRow key={member.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <MemberAvatar
                                        initials={member.initials}
                                        color={member.color}
                                        className="size-9 shrink-0 text-xs"
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {member.name}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {member.email}
                                        </p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <MemberRoleChip role={member.role} />
                            </TableCell>
                            <TableCell>
                                <MemberStatusBadge status={member.status} />
                            </TableCell>
                            <TableCell>
                                <MemberWorkspaces
                                    workspaces={member.workspaces}
                                />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {intl.formatDate(member.joinedAt, {
                                    dateStyle: 'medium'
                                })}
                            </TableCell>
                            <TableCell className="text-right">
                                <MemberRowActions
                                    member={member}
                                    onEdit={onEdit}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
