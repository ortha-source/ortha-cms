import { defineMessages, useIntl } from 'react-intl';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    toast
} from '@ortha-cms/design-system';
import { useUpdateMember } from '../../api/useUpdateMember';
import type { Member, MemberRole } from '../../types/member';

/** Intl descriptors for {@link MemberRoleSelect}, co-located with the component. */
const messages = defineMessages({
    label: {
        id: 'users.role.label',
        defaultMessage: 'Change role for {name}'
    },
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
    },
    lastAdmin: {
        id: 'users.role.lastAdmin',
        defaultMessage:
            'The last remaining admin cannot be demoted. Promote another member to admin first.'
    },
    changed: {
        id: 'users.role.changed',
        defaultMessage: 'Changed {name}’s role to {role}'
    },
    changeFailed: {
        id: 'users.role.changeFailed',
        defaultMessage: 'Couldn’t change the role. Please try again.'
    }
});

const ROLE_OPTIONS: MemberRole[] = ['admin', 'contributor', 'viewer'];

/**
 * The Role column's inline editor: a compact select that submits the new role
 * immediately and toasts the outcome. Read-only callers (no `users:update`)
 * render the plain label instead; the sole active admin's select is disabled
 * with a tooltip explaining the guardrail (the server enforces it too).
 */
export function MemberRoleSelect({
    member,
    editable
}: {
    member: Member;
    editable: boolean;
}) {
    const intl = useIntl();
    const updateMember = useUpdateMember();

    const roleLabel: Record<MemberRole, string> = {
        admin: intl.formatMessage(messages.admin),
        contributor: intl.formatMessage(messages.contributor),
        viewer: intl.formatMessage(messages.viewer)
    };

    if (!editable) {
        return <span className="text-sm">{roleLabel[member.role]}</span>;
    }

    const onRoleChange = (role: string) => {
        if (role === member.role) {
            return;
        }
        updateMember.mutate(
            { id: member.id, role: role as MemberRole },
            {
                onSuccess: () => {
                    toast(
                        intl.formatMessage(messages.changed, {
                            name: member.name,
                            role: roleLabel[role as MemberRole]
                        })
                    );
                },
                onError: () => {
                    toast.error(intl.formatMessage(messages.changeFailed));
                }
            }
        );
    };

    const select = (
        <Select
            value={member.role}
            onValueChange={onRoleChange}
            disabled={member.isLastAdmin || updateMember.isPending}
        >
            <SelectTrigger
                className="h-8 w-[130px]"
                aria-label={intl.formatMessage(messages.label, {
                    name: member.name
                })}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                            {roleLabel[role]}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );

    if (!member.isLastAdmin) {
        return select;
    }

    // A disabled trigger swallows pointer/focus events, so the tooltip hangs
    // off a focusable wrapper — keyboard users get the explanation too.
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex rounded-md">
                    {select}
                </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
                {intl.formatMessage(messages.lastAdmin)}
            </TooltipContent>
        </Tooltip>
    );
}
