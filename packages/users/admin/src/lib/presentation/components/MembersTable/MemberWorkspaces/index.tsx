import { defineMessages, useIntl } from 'react-intl';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@orthacms/design-system';
import { MemberAvatar } from '../../MemberAvatar';
import type { MemberWorkspace } from '../../../../domain/types/member';

/** Intl descriptors for {@link MemberWorkspaces}, co-located with the component. */
const messages = defineMessages({
    open: {
        id: 'users.workspaces.open',
        defaultMessage:
            '{count, plural, one {# workspace} other {# workspaces}}: {names}'
    },
    none: {
        id: 'users.workspaces.none',
        defaultMessage: 'No workspaces'
    }
});

/** Up to this many workspace tiles show before collapsing into a "+N" tile. */
const MAX_TILES = 4;

/**
 * The Workspaces column: a row of small workspace tiles (initials on the
 * workspace's colour), opening a popover that names every workspace. The
 * tiles are decorative; the trigger's accessible name lists the names, so a
 * screen reader hears "2 workspaces: Marketing site, Support hub" rather than
 * four letter-pairs.
 */
export function MemberWorkspaces({
    workspaces
}: {
    workspaces: MemberWorkspace[];
}) {
    const intl = useIntl();

    if (workspaces.length === 0) {
        return (
            <span className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </span>
        );
    }

    const shown = workspaces.slice(0, MAX_TILES);
    const overflow = workspaces.length - shown.length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={intl.formatMessage(messages.open, {
                        count: workspaces.length,
                        names: intl.formatList(
                            workspaces.map((workspace) => workspace.name)
                        )
                    })}
                    onClick={(event) => event.stopPropagation()}
                    className="-m-1 inline-flex items-center gap-[3px] rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {shown.map((workspace) => (
                        <MemberAvatar
                            key={workspace.id}
                            initials={workspace.initials}
                            color={workspace.color}
                            className="size-5 rounded-[5px] text-[9px]"
                        />
                    ))}
                    {overflow > 0 ? (
                        <span
                            aria-hidden
                            className="flex size-5 items-center justify-center rounded-[5px] bg-muted text-[9px] font-semibold text-muted-foreground"
                        >
                            +{overflow}
                        </span>
                    ) : null}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <ul className="max-h-[15rem] overflow-y-auto py-1">
                    {workspaces.map((workspace) => (
                        <li
                            key={workspace.id}
                            className="flex items-center gap-3 px-4 py-2"
                        >
                            <MemberAvatar
                                initials={workspace.initials}
                                color={workspace.color}
                                className="size-6 shrink-0 rounded-md text-[10px]"
                            />
                            <span className="truncate text-sm">
                                {workspace.name}
                            </span>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
