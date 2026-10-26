import { avatarColorVar, cn } from '@orthacms/design-system';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';

/**
 * A workspace's initials tile in its accent colour — the same mark the sidebar
 * shows beside the workspace, so a token's bucket reads at a glance. Purely
 * decorative: the caller names the workspace in text (visible or `sr-only`).
 */
export function WorkspaceMonogram({
    workspace,
    className
}: {
    workspace: Pick<WorkspaceOption, 'initials' | 'color'>;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-semibold leading-none text-white',
                className
            )}
            style={{ backgroundColor: avatarColorVar(workspace.color) }}
        >
            {workspace.initials || '—'}
        </span>
    );
}
