import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Ellipsis } from 'lucide-react';
import { initialsOf } from '@orthacms/utils-admin';
import type { AvatarColor } from '@orthacms/design-system';
import type { WorkspaceMember } from '../../../../../domain/types/workspace';
import { WorkspaceAvatar } from '../../../WorkspaceAvatar';
import { MemberFaces } from '../../../MemberFaces';

const messages = defineMessages({
    justNow: { id: 'workspaces.preview.justNow', defaultMessage: 'Just now' },
    records: {
        id: 'workspaces.card.records',
        defaultMessage:
            '{count, plural, one {<b>#</b> record} other {<b>#</b> records}}'
    },
    typeCount: {
        id: 'workspaces.card.contentTypes',
        defaultMessage:
            '{count, plural, one {<b>#</b> content type} other {<b>#</b> content types}}'
    },
    open: { id: 'workspaces.card.open', defaultMessage: 'Open' },
    settings: { id: 'workspaces.card.settings', defaultMessage: 'Settings' },
    untitled: {
        id: 'workspaces.preview.untitled',
        defaultMessage: 'New workspace'
    }
});

/** Props for {@link CardPreview}. */
export type CardPreviewProps = {
    name: string;
    color: AvatarColor;
    description: string;
    /** The creator, the card's only face so far. */
    creator: Pick<WorkspaceMember, 'id' | 'name' | 'initials' | 'color'>;
};

/**
 * The card the workspace will become, drawn as the list draws one — name,
 * colour and description as people will see them, "Just now", nothing in it
 * yet. A picture: it has no links or buttons of its own.
 */
export function CardPreview({
    name,
    color,
    description,
    creator
}: CardPreviewProps) {
    const intl = useIntl();
    const title = name.trim() || intl.formatMessage(messages.untitled);
    const bold = (chunks: ReactNode[]) => (
        <b key="b" className="font-semibold text-foreground">
            {chunks}
        </b>
    );

    return (
        <div className="flex flex-col rounded-xl border bg-card">
            <div className="flex flex-col gap-3 p-3.5">
                <div className="flex items-start gap-2.5">
                    <WorkspaceAvatar
                        initials={initialsOf(title) || '—'}
                        color={color}
                        className="size-9 shrink-0 rounded-[9px] text-[15px]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">
                            {title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.justNow)}
                        </span>
                    </div>
                    <Ellipsis className="mt-1 size-4 text-muted-foreground" />
                </div>
                {description.trim() ? (
                    <p className="line-clamp-2 text-[13px] break-words text-muted-foreground">
                        {description}
                    </p>
                ) : null}
                <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
                    <span>
                        {intl.formatMessage(messages.records, {
                            count: 0,
                            b: bold
                        })}
                    </span>
                    <span>
                        {intl.formatMessage(messages.typeCount, {
                            count: 0,
                            b: bold
                        })}
                    </span>
                    <MemberFaces members={[creator]} className="ml-auto" />
                </div>
            </div>
            <div className="flex gap-1.5 border-t px-3.5 py-2.5 text-sm">
                <span className="rounded-md border px-2.5 py-1 text-xs font-medium">
                    {intl.formatMessage(messages.open)}
                </span>
                <span className="px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.settings)}
                </span>
            </div>
        </div>
    );
}
