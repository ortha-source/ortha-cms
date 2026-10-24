import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Button, ContainerHeader } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { MemberAvatar } from '../../MemberAvatar';
import { MemberRoleChip } from '../../MembersTable/MemberRoleChip';
import { MemberStatusBadge } from '../../MembersTable/MemberStatusBadge';
import { MemberRowActions } from '../../MembersTable/MemberRowActions';
import { ChangeRoleDialog } from '../../ChangeRoleDialog';
import { useRecencyFormatter } from '../../../recencyLabel';
import type { Member } from '../../../../domain/types/member';

/** Intl descriptors for {@link UserHero}, co-located with the component. */
const messages = defineMessages({
    memberSince: {
        id: 'users.detail.hero.memberSince',
        defaultMessage: 'Member since {date}'
    },
    invitedOn: {
        id: 'users.detail.hero.invitedOn',
        defaultMessage: 'Invited {date}'
    },
    neverActive: {
        id: 'users.detail.hero.neverActive',
        defaultMessage: 'Never signed in'
    },
    changeRole: {
        id: 'users.detail.hero.changeRole',
        defaultMessage: 'Change role'
    }
});

/**
 * The member page's header — **one page about a person**: a large avatar, the
 * name as the page's `<h1>`, and on one line their status, role, address, when
 * they joined and when they were last active. Role is changed from here
 * (**Change role** opens the role dialog), not from a tab; everything else a
 * member's status allows sits in the `⋯` menu beside it.
 */
export function UserHero({ member }: { member: Member }) {
    const intl = useIntl();
    const navigate = useNavigate();
    const canManage = useHasPermission('users:update');
    const formatRecency = useRecencyFormatter();
    const [changingRole, setChangingRole] = useState(false);

    const since =
        member.status === 'pending'
            ? intl.formatMessage(messages.invitedOn, {
                  date: intl.formatDate(member.joinedAt, {
                      dateStyle: 'medium'
                  })
              })
            : intl.formatMessage(messages.memberSince, {
                  date: intl.formatDate(member.joinedAt, {
                      month: 'short',
                      year: 'numeric'
                  })
              });
    const active =
        member.status === 'pending'
            ? null
            : member.lastActiveAt
              ? formatRecency(member.lastActiveAt, 'active')
              : intl.formatMessage(messages.neverActive);
    const facts = [member.email, since, active].filter(
        (fact): fact is string => fact !== null
    );

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <MemberAvatar
                initials={member.initials}
                color={member.color}
                className="size-14 shrink-0 rounded-full text-xl"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <ContainerHeader
                    className="mb-0"
                    titleClassName="truncate text-[26px] leading-8"
                    title={member.name}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                    <MemberStatusBadge status={member.status} />
                    <MemberRoleChip
                        role={member.role}
                        roleName={member.roleName}
                    />
                    {facts.map((fact, index) => (
                        <span key={fact} className="flex items-center gap-2">
                            {index > 0 ? <span aria-hidden>·</span> : null}
                            <span className="truncate">{fact}</span>
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {canManage && member.status === 'active' ? (
                    <Button
                        variant="outline"
                        onClick={() => setChangingRole(true)}
                    >
                        {intl.formatMessage(messages.changeRole)}
                    </Button>
                ) : null}
                <MemberRowActions
                    member={member}
                    variant="detail"
                    onRemoved={() => navigate('/users')}
                />
            </div>
            {canManage && member.status === 'active' ? (
                <ChangeRoleDialog
                    member={member}
                    open={changingRole}
                    onOpenChange={setChangingRole}
                />
            ) : null}
        </div>
    );
}
