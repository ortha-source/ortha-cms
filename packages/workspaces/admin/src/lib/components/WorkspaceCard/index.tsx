import { useNavigate } from 'react-router-dom';
import { cn } from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import { StatusChip } from './StatusChip';
import { MemberStack } from './MemberStack';
import type { Workspace } from '../../types/workspace';

/**
 * A workspace card. The whole card is clickable to open the workspace, but the
 * card itself is **not** an interactive element — a single real `<button>` on
 * the title carries the action and its `::after` overlay stretches across the
 * card to make the entire surface the hit target. The member stack sits above
 * that overlay (`relative z-10`) as a sibling button, so the two controls never
 * nest (which would violate WCAG 4.1.2) and each is independently operable. The
 * card is a labelled `group` rather than a button — there is no actions menu and
 * no role shown, since role is a property of the current user, not the card.
 */
export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
    const navigate = useNavigate();
    const isArchived = workspace.status === 'Archived';

    // TODO(workspaces-detail): point at the real workspace detail route once it
    // exists; today there is no `/workspaces/:id` page.
    const open = () => navigate(`/workspaces/${workspace.id}`);

    return (
        <div
            role="group"
            aria-label={workspace.name}
            className={cn(
                'group relative flex flex-col rounded-2xl border p-5 transition',
                'hover:-translate-y-0.5 hover:border-[oklch(0.86_0_0)] hover:shadow-md',
                // Archived cards recede via a muted background rather than reduced
                // opacity — dimming the whole card drops its text below the WCAG
                // AA contrast threshold (verified by the admin-e2e axe scan).
                isArchived ? 'bg-muted/40' : 'bg-card'
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
                        <button
                            type="button"
                            onClick={open}
                            className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                            {workspace.name}
                        </button>
                    </h3>
                    <div className="mt-1.5">
                        <StatusChip status={workspace.status} />
                    </div>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[2.7em] text-[13.5px] leading-snug text-muted-foreground">
                {workspace.description}
            </p>

            <div className="relative z-10 mt-4 border-t pt-4">
                <MemberStack members={workspace.members} />
            </div>
        </div>
    );
}
