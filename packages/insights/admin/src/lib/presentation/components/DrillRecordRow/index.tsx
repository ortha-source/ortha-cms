import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Avatar,
    AvatarFallback,
    avatarColorVar,
    cn
} from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';

/** Intl descriptors for a drill-down row, co-located here. */
const messages = defineMessages({
    former: {
        id: 'insights.drill.formerMember',
        defaultMessage: 'A former member'
    },
    by: {
        id: 'insights.drill.by',
        defaultMessage: 'Last edited by {name}'
    }
});

/** Props for {@link DrillRecordRow}. */
export type DrillRecordRowProps = {
    /** The record's name. */
    title: ReactNode;
    /** The line under it — "Guides · last edited Aug 2024". */
    meta: ReactNode;
    /** Where the row goes, relative to the Insights route. Omit for a plain row. */
    to?: string;
    /**
     * A person to show at the right, as a user id. Resolved against the open
     * workspace's roster — which the shell already holds, so naming a person
     * costs no request — and named as a former member when they have left,
     * rather than given an invented label.
     */
    personId?: string | null;
    /** What the person did, for the avatar's name — defaults to "Last edited by". */
    personLabel?: (name: string) => string;
};

/**
 * One record in a drill-down: its name, a line of context, and the person
 * behind it — the whole row a link to the record when it has one.
 */
export function DrillRecordRow({
    title,
    meta,
    to,
    personId,
    personLabel
}: DrillRecordRowProps) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const member = personId
        ? workspace?.members.find((entry) => entry.id === personId)
        : undefined;
    const name = member?.name ?? intl.formatMessage(messages.former);
    const label = personLabel
        ? personLabel(name)
        : intl.formatMessage(messages.by, { name });

    const body = (
        <>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{title}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {meta}
                </span>
            </span>
            {personId ? (
                <span title={label} className="shrink-0">
                    <Avatar
                        className="size-[22px]"
                        style={
                            member
                                ? { backgroundColor: avatarColorVar(member.color) }
                                : undefined
                        }
                    >
                        <AvatarFallback
                            className={cn(
                                'text-[9px]',
                                member && 'bg-transparent font-semibold text-white'
                            )}
                        >
                            {member?.initials ?? '—'}
                        </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">{label}</span>
                </span>
            ) : null}
        </>
    );

    const rowClass = 'flex items-center gap-3 px-4 py-3';

    return (
        <li>
            {to ? (
                <Link
                    to={to}
                    className={cn(
                        rowClass,
                        'outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                    )}
                >
                    {body}
                </Link>
            ) : (
                <div className={rowClass}>{body}</div>
            )}
        </li>
    );
}
