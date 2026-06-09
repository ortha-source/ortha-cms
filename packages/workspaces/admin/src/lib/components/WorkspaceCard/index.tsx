import { useNavigate } from 'react-router-dom';
import { cn } from '@ortha-cms/design-system';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import { StatusChip } from '../StatusChip';
import { MemberStack } from '../MemberStack';
import type { Workspace } from '../../types/workspace';

/** Derives up-to-two-letter initials from a workspace name. */
function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/**
 * A workspace as a single focusable card-button: avatar, name, status, a
 * two-line description (height reserved so cards align), and the member stack.
 * Clicking or pressing Enter opens the workspace. There is no per-card actions
 * menu and no role — role is a property of the current user, not the card.
 */
export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
    const navigate = useNavigate();
    const isArchived = workspace.status === 'Archived';

    // TODO(workspaces-detail): point at the real workspace detail route once it
    // exists; today there is no `/workspaces/:id` page.
    const open = () => navigate(`/workspaces/${workspace.id}`);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    open();
                }
            }}
            className={cn(
                'group flex cursor-pointer flex-col rounded-2xl border bg-card p-5 text-left transition',
                'hover:-translate-y-0.5 hover:border-[oklch(0.86_0_0)] hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isArchived && 'opacity-[0.62]'
            )}
        >
            <div className="flex items-start gap-3">
                <WorkspaceAvatar
                    initials={initialsOf(workspace.name)}
                    color={workspace.color}
                    className="size-11 shrink-0 text-base"
                />
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold tracking-[-0.01em]">
                        {workspace.name}
                    </h3>
                    <div className="mt-1.5">
                        <StatusChip status={workspace.status} />
                    </div>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[2.7em] text-[13.5px] leading-snug text-muted-foreground">
                {workspace.description}
            </p>

            <div className="mt-4 border-t pt-4">
                <MemberStack members={workspace.members} />
            </div>
        </div>
    );
}
