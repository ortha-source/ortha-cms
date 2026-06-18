import { defineMessages, useIntl } from 'react-intl';
import { WorkspaceAvatar } from '../../../WorkspaceAvatar';
import type { WorkspaceMember } from '../../../../types/workspace';

/** Intl descriptors for {@link MemberListPopover}, co-located with the component. */
const messages = defineMessages({
    heading: {
        id: 'workspaces.members.heading',
        defaultMessage: '{count, plural, one {# member} other {# members}}'
    }
});

/**
 * The body of the member popover: a count header over a scrollable list of
 * every member (avatar, name, email). Scrolls once it grows past ~6 rows.
 */
export function MemberListPopover({ members }: { members: WorkspaceMember[] }) {
    const intl = useIntl();

    return (
        <div className="flex flex-col">
            <div className="border-b px-4 py-3 text-sm font-semibold">
                {intl.formatMessage(messages.heading, {
                    count: members.length
                })}
            </div>
            <ul className="max-h-[15rem] overflow-y-auto py-1">
                {members.map((member) => (
                    <li
                        key={member.id}
                        className="flex items-center gap-3 px-4 py-2"
                    >
                        <WorkspaceAvatar
                            initials={member.initials}
                            color={member.color}
                            className="size-[30px] shrink-0 text-xs"
                        />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {member.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {member.email}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
