import { defineMessages, useIntl } from 'react-intl';
import {
    Popover,
    PopoverTrigger,
    PopoverContent
} from '@ortha-cms/design-system';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import { MemberListPopover } from '../MemberListPopover';
import type { WorkspaceMember } from '../../types/workspace';

/** Intl descriptors for {@link MemberStack}, co-located with the component. */
const messages = defineMessages({
    count: {
        id: 'workspaces.members.count',
        defaultMessage: '{count, plural, one {# member} other {# members}}'
    },
    open: {
        id: 'workspaces.members.open',
        defaultMessage: 'View members'
    }
});

/** Up to this many avatars show before collapsing into a "+N" pill. */
const MAX_AVATARS = 4;

/**
 * The card footer's member control: a row of overlapping avatars plus a member
 * count. Clicking opens a popover listing every member. It renders above the
 * card's click overlay (the card places it in a `relative z-10` row), so it is a
 * sibling of — not nested in — the card's open button and activates on its own.
 */
export function MemberStack({ members }: { members: WorkspaceMember[] }) {
    const intl = useIntl();
    const shown = members.slice(0, MAX_AVATARS);
    const overflow = members.length - shown.length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={intl.formatMessage(messages.open)}
                    className="-m-1 flex items-center gap-2 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="flex">
                        {shown.map((member, index) => (
                            <WorkspaceAvatar
                                key={member.id}
                                initials={member.initials}
                                color={member.color}
                                className="size-[26px] border-2 border-card text-[10px]"
                                style={{ marginLeft: index === 0 ? 0 : -8 }}
                            />
                        ))}
                        {overflow > 0 ? (
                            <span
                                className="flex size-[26px] items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold text-muted-foreground"
                                style={{ marginLeft: -8 }}
                            >
                                +{overflow}
                            </span>
                        ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.count, {
                            count: members.length
                        })}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                <MemberListPopover members={members} />
            </PopoverContent>
        </Popover>
    );
}
