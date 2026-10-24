import type { Ref } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useAuth } from '@orthacms/identity-admin';
import { AVATAR_COLORS, type AvatarColor } from '@orthacms/design-system';
import type { MemberDraft } from '../../../../domain/types/wizard';
import { PersonRow } from './PersonRow';
import { MemberTypeahead } from './MemberTypeahead';

const messages = defineMessages({
    title: {
        id: 'workspaces.create.people.title',
        defaultMessage: 'Who works here?'
    },
    help: {
        id: 'workspaces.create.people.help',
        defaultMessage:
            'Add members now or later. Their role is the same as everywhere else in Ortha.'
    },
    listLabel: {
        id: 'workspaces.create.members.listLabel',
        defaultMessage: 'People with access'
    },
    you: {
        id: 'workspaces.create.members.you',
        defaultMessage: 'You'
    }
});

/** Props for {@link PeopleStep}. */
export type PeopleStepProps = {
    /** The step heading — the focus target after a step change. */
    titleRef: Ref<HTMLHeadingElement>;
    /** Added members (excludes the creator). */
    members: MemberDraft[];
    /** Add a member. */
    addMember: (member: MemberDraft) => void;
    /** Remove a member by id. */
    removeMember: (id: string) => void;
    /** Whether the creator may issue invitations (`users:create`). */
    canInvite: boolean;
    /** The creator's avatar tint (the workspace colour). */
    color: AvatarColor;
};

/**
 * The people step body — members and invites in one box: type a name to add
 * someone from the directory, or an email to invite someone new; both land in
 * the same list, each saying what will happen. The creator heads the list as
 * "You" and cannot be removed — the first member, with no special status.
 */
export function PeopleStep({
    titleRef,
    members,
    addMember,
    removeMember,
    canInvite,
    color
}: PeopleStepProps) {
    const intl = useIntl();
    const auth = useAuth();
    const user = 'user' in auth ? auth.user : undefined;

    const you = intl.formatMessage(messages.you);
    const ownerName = user?.name ?? user?.email ?? you;
    const ownerId = user?.id ?? 'me';
    const excludeIds = new Set<string>([
        ownerId,
        ...members.map((m) => m.id),
        ...(user?.email ? [user.email.toLowerCase()] : [])
    ]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2
                    ref={titleRef}
                    tabIndex={-1}
                    className="text-sm font-semibold focus-visible:outline-none"
                >
                    {intl.formatMessage(messages.title)}
                </h2>
                <p className="text-[13px] text-muted-foreground">
                    {intl.formatMessage(messages.help)}
                </p>
            </div>

            <MemberTypeahead excludeIds={excludeIds} onAdd={addMember} />

            <ul
                aria-label={intl.formatMessage(messages.listLabel)}
                className="overflow-hidden rounded-xl border"
            >
                <PersonRow
                    name={ownerName}
                    email={user?.email ?? ''}
                    color={color}
                    badge={you}
                />
                {members.map((member, index) => (
                    <PersonRow
                        key={member.id}
                        name={member.name}
                        email={member.email}
                        color={
                            AVATAR_COLORS[(index + 1) % AVATAR_COLORS.length]
                        }
                        invited={member.invited}
                        canInvite={canInvite}
                        badge={member.role}
                        onRemove={() => removeMember(member.id)}
                    />
                ))}
            </ul>
        </div>
    );
}
