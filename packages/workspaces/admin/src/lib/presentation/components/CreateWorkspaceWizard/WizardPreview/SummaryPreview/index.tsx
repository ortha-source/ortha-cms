import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { initialsOf } from '@orthacms/utils-admin';
import type { AvatarColor } from '@orthacms/design-system';
import { WorkspaceAvatar } from '../../../WorkspaceAvatar';

const messages = defineMessages({
    untitled: {
        id: 'workspaces.preview.untitled',
        defaultMessage: 'New workspace'
    }
});

/** Props for {@link SummaryPreview}. */
export type SummaryPreviewProps = {
    name: string;
    color: AvatarColor;
    /** The one-line summary under the name ("4 content types · 1 shared"). */
    summary: string;
    /** What the workspace holds — tags or faces. */
    children?: ReactNode;
};

/**
 * The compact preview the later steps show: the workspace's tile and name,
 * a one-line summary of what has been chosen so far, and the choices
 * themselves underneath.
 */
export function SummaryPreview({
    name,
    color,
    summary,
    children
}: SummaryPreviewProps) {
    const intl = useIntl();
    const title = name.trim() || intl.formatMessage(messages.untitled);

    return (
        <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
            <div className="flex items-center gap-2">
                <WorkspaceAvatar
                    initials={initialsOf(title) || '—'}
                    color={color}
                    className="size-7 shrink-0 rounded-[7px] text-[10px]"
                />
                <span className="truncate text-sm font-semibold">{title}</span>
            </div>
            <span className="text-xs text-muted-foreground">{summary}</span>
            {children}
        </div>
    );
}
