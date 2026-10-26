import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { WorkspaceMember } from '../../../domain/types/workspace';
import { WorkspaceAvatar } from '../WorkspaceAvatar';

const messages = defineMessages({
    more: { id: 'workspaces.faces.more', defaultMessage: '+{count}' },
    label: {
        id: 'workspaces.faces.label',
        defaultMessage:
            '{count, plural, one {# member} other {# members}}: {names}'
    }
});

/** Props for {@link MemberFaces}. */
export type MemberFacesProps = {
    /** Everyone in the workspace. */
    members: readonly Pick<
        WorkspaceMember,
        'id' | 'name' | 'initials' | 'color'
    >[];
    /** How many faces to stack before "+N" says the rest. */
    max?: number;
    /** Extra classes on the row. */
    className?: string;
};

/**
 * Who is in a workspace, as faces: up to `max` overlapping initials avatars
 * (each titled with the person's name for the pointer) and a quiet "+N" for
 * the rest. One accessible name says the count and the names, so the stack is
 * read once rather than as a run of initials.
 */
export function MemberFaces({ members, max = 4, className }: MemberFacesProps) {
    const intl = useIntl();
    if (members.length === 0) return null;
    const shown = members.slice(0, max);
    const rest = members.length - shown.length;

    return (
        <span
            role="img"
            aria-label={intl.formatMessage(messages.label, {
                count: members.length,
                names: intl.formatList(members.map((member) => member.name))
            })}
            className={cn('flex items-center gap-1.5', className)}
        >
            <span className="flex">
                {shown.map((member) => (
                    <span
                        key={member.id}
                        title={member.name}
                        className="-ml-1.5 first:ml-0"
                    >
                        <WorkspaceAvatar
                            initials={member.initials}
                            color={member.color}
                            className="size-5 rounded-full text-[9px] ring-2 ring-card"
                        />
                    </span>
                ))}
            </span>
            {rest > 0 ? (
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.more, { count: rest })}
                </span>
            ) : null}
        </span>
    );
}
