import { Check } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import { initialsOf } from '@orthacms/utils-admin';
import { WorkspaceAvatar, type Workspace } from '@orthacms/workspaces-admin';

type Props = {
    workspace: Pick<Workspace, 'id' | 'name' | 'slug' | 'color'>;
    selected: boolean;
    onToggle: () => void;
};

/** One workspace as a tile: its monogram, its name and slug, ticked when picked. */
export function WorkspaceTile({ workspace, selected, onToggle }: Props) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-labelledby={`grant-${workspace.id}-name`}
            onClick={onToggle}
            className={cn(
                'relative flex items-center gap-3 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary bg-accent' : 'hover:bg-accent/60'
            )}
        >
            <WorkspaceAvatar
                initials={initialsOf(workspace.name)}
                color={workspace.color}
                className="size-9 shrink-0 text-xs"
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span
                    id={`grant-${workspace.id}-name`}
                    className="truncate text-sm font-medium"
                >
                    {workspace.name}
                </span>
                {workspace.slug && (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                        {workspace.slug}
                    </span>
                )}
            </span>
            <span
                aria-hidden
                className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40'
                )}
            >
                {selected && <Check className="size-3.5" />}
            </span>
        </button>
    );
}
